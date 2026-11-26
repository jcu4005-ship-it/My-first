/**
 * 통합·화면 테스트 대상 설정.
 * - local(기본): `supabase status -o env` 값 (로컬/CI 일회용 DB)
 * - staging: 배포된 스테이징 (TEST_TARGET=staging). 운영 대상은 거부합니다.
 * 비밀키는 테스트 계정 준비용으로만 사용하며 출력하지 않습니다.
 */
export const testTarget: "local" | "staging" = process.env.TEST_TARGET === "staging" ? "staging" : "local";
export const isStaging = testTarget === "staging";

export const testEnv = {
  supabaseUrl: process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:54321",
  publishableKey: process.env.TEST_SUPABASE_PUBLISHABLE_KEY ?? "",
  secretKey: process.env.TEST_SUPABASE_SECRET_KEY ?? "",
  dbUrl: process.env.TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  mailpitUrl: process.env.TEST_MAILPIT_URL ?? "http://127.0.0.1:54324",
  appUrl: process.env.TEST_APP_URL ?? "http://localhost:3000",
  /** Vercel 접근 보호 우회 값 (스테이징 주소로 가는 요청에만 붙임) */
  vercelBypass: process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "",
};

export function requireTestEnv() {
  if (!testEnv.publishableKey || !testEnv.secretKey) {
    throw new Error(
      "TEST_SUPABASE_PUBLISHABLE_KEY / TEST_SUPABASE_SECRET_KEY 가 없습니다. 로컬은 `eval \"$(npm run -s test:env)\"` 후 실행하세요.",
    );
  }
  const host = new URL(testEnv.supabaseUrl).hostname;
  const local = ["127.0.0.1", "localhost"].includes(host);
  if (!isStaging && !local) {
    throw new Error("로컬 테스트는 로컬/CI의 일회용 Supabase에서만 실행합니다. 스테이징은 TEST_TARGET=staging 으로 실행하세요.");
  }
  if (isStaging) {
    const prodSupabase = process.env.PRODUCTION_SUPABASE_URL;
    const prodApp = process.env.PRODUCTION_APP_URL;
    if (local || !testEnv.appUrl.startsWith("https://")) throw new Error("스테이징 테스트 대상 주소가 올바르지 않습니다.");
    if ((prodSupabase && testEnv.supabaseUrl === prodSupabase) || (prodApp && testEnv.appUrl === prodApp)) {
      throw new Error("운영 환경을 대상으로 테스트할 수 없습니다.");
    }
  }
}

/** DB 직접 접속·로컬 메일함이 필요한 테스트는 로컬 전용 */
export function localOnly(): boolean {
  return !isStaging;
}
