import { z } from "zod";

import { NICKNAME_MESSAGES, cleanNickname, nicknameProblem } from "./nickname";

/**
 * 비밀번호 규칙: 최소 10자, 영문과 숫자 포함 (최대 72바이트 — 암호화 방식 한계)
 * Supabase Auth 설정(minimum_password_length=10, password_requirements=letters_digits)과 동일.
 */
export const PASSWORD_MIN = 10;
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`)
  .refine((v) => new TextEncoder().encode(v).length <= 72, "비밀번호가 너무 깁니다.")
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), "비밀번호에 영문과 숫자를 모두 포함해 주세요.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("이메일 주소를 확인해 주세요.").max(254));

export const nicknameSchema = z
  .string()
  .transform(cleanNickname)
  .superRefine((v, ctx) => {
    const problem = nicknameProblem(v);
    if (problem) ctx.addIssue({ code: "custom", message: NICKNAME_MESSAGES[problem] });
  });

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined(), z.null()])
  .transform((v) => v === "on" || v === "true");

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
    nickname: nicknameSchema,
    agreeTerms: checkbox,
    agreePrivacy: checkbox,
    confirmAge14: checkbox,
    agreeMarketing: checkbox,
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.passwordConfirm) {
      ctx.addIssue({ code: "custom", path: ["passwordConfirm"], message: "비밀번호가 일치하지 않습니다." });
    }
    if (!v.agreeTerms) ctx.addIssue({ code: "custom", path: ["agreeTerms"], message: "이용약관에 동의해 주세요." });
    if (!v.agreePrivacy) {
      ctx.addIssue({ code: "custom", path: ["agreePrivacy"], message: "개인정보 수집·이용에 동의해 주세요." });
    }
    if (!v.confirmAge14) {
      ctx.addIssue({ code: "custom", path: ["confirmAge14"], message: "만 14세 이상만 가입할 수 있습니다." });
    }
  });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "비밀번호를 입력해 주세요.").max(200),
});

export const resetRequestSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "비밀번호가 일치하지 않습니다.",
  });

export const profileUpdateSchema = z.object({
  nickname: nicknameSchema,
  bio: z
    .string()
    .trim()
    .max(300, "소개는 300자 이내로 입력해 주세요.")
    .transform((v) => (v === "" ? null : v)),
});

const currentYear = new Date().getFullYear();
export const privateUpdateSchema = z.object({
  phone: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => v === "" || /^01[0-9]{8,9}$/.test(v), "휴대폰 번호 형식을 확인해 주세요. (예: 010-1234-5678)")
    .transform((v) => (v === "" ? null : v)),
  birthYear: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}$/.test(v), "출생연도를 4자리 숫자로 입력해 주세요.")
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (v >= 1900 && v <= currentYear), "출생연도를 확인해 주세요."),
});

export const adminReasonSchema = z
  .string()
  .trim()
  .min(5, "사유를 5자 이상 입력해 주세요.")
  .max(500, "사유는 500자 이내로 입력해 주세요.");

/** 첫 번째 오류 메시지를 필드별로 모읍니다 (화면 표시용) */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
