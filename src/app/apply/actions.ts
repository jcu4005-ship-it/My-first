"use server";

import { notifyFounderNewApplication } from "@/lib/notify/founder";
import { formValue, type FormState } from "@/lib/forms";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/auth";
import { CREATOR_APPLICATION_KEYS, creatorApplicationSchema } from "@/lib/validation/creator-application";

/** 크리에이터 지원 접수 (로그인 없이 가능). 검증·중복 방지는 DB 함수가 다시 확인 */
export async function submitCreatorApplicationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  // 자동 입력 방지용 숨은 칸: 사람은 비워 둠. 채워져 있으면 성공한 척하고 저장하지 않음
  if (formValue(formData, "website") !== "") {
    return { status: "success", message: "지원이 접수되었습니다." };
  }
  const values = Object.fromEntries(
    CREATOR_APPLICATION_KEYS.map((k) => [k, k === "consent" ? (formData.get("consent") === "on" ? "on" : "") : formValue(formData, k)]),
  );
  const parsed = creatorApplicationSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", message: "표시된 항목을 확인해 주세요.", fieldErrors: fieldErrors(parsed.error), values };
  }
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_creator_application", {
    p_name: v.name,
    p_field: v.field,
    p_strength: v.strength,
    p_experience: v.experience,
    p_motivation: v.motivation,
    p_phone: v.phone,
    p_link: v.link === "" ? null : v.link,
    p_wish: v.wish === "" ? null : v.wish,
    p_consent: true,
  });
  if (error) return { status: "error", message: rpcErrorMessage(error), values };
  await notifyFounderNewApplication("creator");
  return { status: "success", message: "지원이 접수되었습니다." };
}
