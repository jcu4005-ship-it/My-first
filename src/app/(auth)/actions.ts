"use server";

import { redirect } from "next/navigation";

import { LEGAL_DOCUMENTS } from "@/config/legal";
import { formValue, type FormState } from "@/lib/forms";
import { safeNextPath } from "@/lib/safe-redirect";
import { requestOrigin } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fieldErrors,
  newPasswordSchema,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

const GENERIC_ERROR = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

/** 회원가입 — 역할은 DB가 participant로만 부여합니다(가입 정보로 역할 지정 불가). */
export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(
    ["email", "password", "passwordConfirm", "nickname", "agreeTerms", "agreePrivacy", "confirmAge14", "agreeMarketing"].map(
      (k) => [k, formValue(formData, k)],
    ),
  );
  const values = { email: raw.email, nickname: raw.nickname };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  }
  const input = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data: available, error: availError } = await supabase.rpc("nickname_available", {
    p_nickname: input.nickname,
  });
  if (availError) return { status: "error", message: GENERIC_ERROR, values };
  if (!available) {
    return { status: "error", fieldErrors: { nickname: "이미 사용 중이거나 사용할 수 없는 닉네임입니다." }, values };
  }

  const origin = await requestOrigin();
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      // Supabase 기본 메일 문구를 쓰는 경우 돌아올 주소
      emailRedirectTo: `${origin}/auth/callback?flow=signup&next=/me`,
      data: {
        nickname: input.nickname,
        consents: {
          terms_version: LEGAL_DOCUMENTS.terms.version,
          privacy_version: LEGAL_DOCUMENTS.privacy.version,
          marketing_version: LEGAL_DOCUMENTS.marketing.version,
          age_14_plus: input.confirmAge14,
          marketing: input.agreeMarketing,
        },
      },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: "비밀번호는 10자 이상, 영문과 숫자를 포함해야 합니다." }, values };
    }
    if (error.code === "email_address_invalid") {
      return { status: "error", fieldErrors: { email: "사용할 수 없는 이메일 주소입니다." }, values };
    }
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return { status: "error", message: "요청이 많습니다. 잠시 후 다시 시도해 주세요.", values };
    }
    // 동시에 같은 닉네임이 가입된 경우 등 DB 규칙 위반
    if (error.message?.includes("Database error")) {
      return { status: "error", fieldErrors: { nickname: "이미 사용 중이거나 사용할 수 없는 닉네임입니다." }, values };
    }
    return { status: "error", message: GENERIC_ERROR, values };
  }

  // 이미 가입된 이메일이어도 같은 안내를 보여 줘 가입 여부가 드러나지 않게 합니다.
  redirect("/check-email?type=signup");
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: formValue(formData, "email") };
  const parsed = signInSchema.safeParse({ email: values.email, password: formValue(formData, "password") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { status: "error", message: "이메일 인증을 완료한 뒤 로그인해 주세요.", values };
    }
    if (error.status === 429) return { status: "error", message: "로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.", values };
    return { status: "error", message: "이메일 또는 비밀번호가 올바르지 않습니다.", values };
  }
  redirect(safeNextPath(formValue(formData, "next")));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: formValue(formData, "email") };
  const parsed = resetRequestSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await requestOrigin()}/auth/callback?flow=recovery`,
  });
  if (error && error.status === 429) {
    return { status: "error", message: "요청이 많습니다. 잠시 후 다시 시도해 주세요.", values };
  }
  // 가입 여부와 관계없이 같은 안내 (계정 존재 여부 노출 방지)
  redirect("/check-email?type=recovery");
}

export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({
    password: formValue(formData, "password"),
    passwordConfirm: formValue(formData, "passwordConfirm"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login?next=/reset-password");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: "비밀번호는 10자 이상, 영문과 숫자를 포함해야 합니다." } };
    }
    if (error.code === "same_password") {
      return { status: "error", fieldErrors: { password: "이전과 다른 비밀번호를 입력해 주세요." } };
    }
    if (error.code === "reauthentication_needed") {
      return { status: "error", message: "보안을 위해 비밀번호 재설정 메일을 다시 요청해 주세요." };
    }
    return { status: "error", message: GENERIC_ERROR };
  }
  redirect("/me?notice=password-updated");
}
