/**
 * 환경변수 검증
 *
 * - 비밀키는 코드에 쓰지 않고 환경변수로만 받습니다.
 * - 잘못된 설정(실결제 모드, 운영 결제키, 브라우저로 노출되는 비밀키)은 서버 시작·빌드 단계에서 바로 막습니다.
 * - 이 파일은 순수 함수만 포함해 자동 테스트가 가능합니다.
 */
import { z } from "zod";

export const APP_ENVS = ["local", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/**
 * 결제 모드는 현재 "test"만 허용합니다.
 * 실결제(live)는 PG 계약·정산 구조 확인 및 창업자 승인 후 별도 변경으로만 추가합니다. (설계안 2-6, 10-1)
 */
export const ALLOWED_PAYMENT_MODES = ["test"] as const;
export type PaymentMode = (typeof ALLOWED_PAYMENT_MODES)[number];

const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const envSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(APP_ENVS).default("local"),
  NEXT_PUBLIC_SITE_URL: optionalString.pipe(z.string().url().optional()),

  NEXT_PUBLIC_SUPABASE_URL: optionalString.pipe(z.string().url().optional()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
  SUPABASE_SECRET_KEY: optionalString,

  NEXT_PUBLIC_PAYMENT_MODE: z
    .string()
    .default("test")
    .refine((v) => (ALLOWED_PAYMENT_MODES as readonly string[]).includes(v), {
      message:
        "실결제(live) 모드는 아직 허용되지 않습니다. PG 계약·정산 구조 확인과 승인 후 활성화됩니다. NEXT_PUBLIC_PAYMENT_MODE=test 로 설정하세요.",
    })
    .transform((v) => v as PaymentMode),
  NEXT_PUBLIC_TOSS_CLIENT_KEY: optionalString,
  TOSS_SECRET_KEY: optionalString,
});

export type Env = z.infer<typeof envSchema>;

export type EnvResult =
  | { ok: true; env: Env }
  | { ok: false; errors: string[] };

/** 이름에 이런 단어가 있으면 브라우저로 노출되면 안 되는 비밀값으로 봅니다. */
const SECRET_NAME_PATTERN = /(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD)/i;

/** JWT 형태의 Supabase 키에서 role 값을 꺼냅니다(구형 anon/service_role 키 대비). */
function jwtRole(token: string): string | undefined {
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : undefined;
  } catch {
    return undefined;
  }
}

export function parseEnv(source: Record<string, string | undefined>): EnvResult {
  const errors: string[] = [];

  // 1) NEXT_PUBLIC_ 접두사는 브라우저에 그대로 노출됩니다. 비밀값 이름에 붙어 있으면 차단합니다.
  for (const key of Object.keys(source)) {
    if (key.startsWith("NEXT_PUBLIC_") && SECRET_NAME_PATTERN.test(key)) {
      errors.push(
        `${key}: 비밀값으로 보이는 환경변수에 NEXT_PUBLIC_ 접두사가 붙어 있어 브라우저에 노출됩니다. 접두사를 제거하세요.`,
      );
    }
  }

  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join(".") || "(env)"}: ${issue.message}`);
    }
    return { ok: false, errors };
  }
  const env = parsed.data;

  // 2) 공개용 Supabase 키 자리에 비밀키가 들어간 경우 차단
  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (publishable) {
    if (publishable.startsWith("sb_secret_") || jwtRole(publishable) === "service_role") {
      errors.push(
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 비밀키(secret/service_role)가 들어 있습니다. 공개용(publishable/anon) 키를 넣으세요.",
      );
    }
  }

  // 3) 테스트 결제 모드에서는 토스페이먼츠 테스트 키(test_ 로 시작)만 허용
  if (env.NEXT_PUBLIC_PAYMENT_MODE === "test") {
    for (const [name, value] of [
      ["NEXT_PUBLIC_TOSS_CLIENT_KEY", env.NEXT_PUBLIC_TOSS_CLIENT_KEY],
      ["TOSS_SECRET_KEY", env.TOSS_SECRET_KEY],
    ] as const) {
      if (value && !value.startsWith("test_")) {
        errors.push(
          `${name}: 테스트 결제 모드에서는 토스페이먼츠 테스트 키(test_ 로 시작)만 사용할 수 있습니다.`,
        );
      }
    }
  }

  // 4) 운영 환경은 사이트 주소와 Supabase 연결이 필수
  if (env.NEXT_PUBLIC_APP_ENV === "production") {
    for (const name of [
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ] as const) {
      if (!env[name]) errors.push(`${name}: 운영(production) 환경에서는 필수입니다.`);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, env };
}

/** 검증 실패 시 이유를 모두 담아 예외를 던집니다. 빌드·서버 시작 시 사용합니다. */
export function assertValidEnv(source: Record<string, string | undefined>): Env {
  const result = parseEnv(source);
  if (!result.ok) {
    throw new Error(
      ["환경변수 설정에 문제가 있습니다:", ...result.errors.map((e) => `  - ${e}`)].join("\n"),
    );
  }
  return result.env;
}

/** 외부 서비스 연결 상태 요약 (값은 노출하지 않고 설정 여부만) */
export function integrationStatus(env: Env) {
  return {
    supabase: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    supabaseServer: Boolean(env.SUPABASE_SECRET_KEY),
    tossPayments: Boolean(env.NEXT_PUBLIC_TOSS_CLIENT_KEY && env.TOSS_SECRET_KEY),
  };
}
