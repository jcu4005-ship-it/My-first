"use server";

import { revalidatePath } from "next/cache";

import { getCurrentMember } from "@/lib/auth/session";
import { formValue, type FormState } from "@/lib/forms";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/auth";
import { APPLICATION_KEYS, applicationDraftSchema, applicationSubmitSchema } from "@/lib/validation/host-application";

/** 호스트 지원서: intent=save(임시 저장) | submit(제출). 상태 변경·필수 검사는 DB 함수가 다시 확인 */
export async function hostApplicationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member || member.status !== "active") return { status: "error", message: "로그인이 필요합니다." };
  const intent = formValue(formData, "intent") === "submit" ? "submit" : "save";
  const values = Object.fromEntries(APPLICATION_KEYS.map((k) => [k, k === "consent" ? (formData.get("consent") === "on" ? "on" : "") : formValue(formData, k)]));
  const parsed = (intent === "submit" ? applicationSubmitSchema : applicationDraftSchema).safeParse(values);
  if (!parsed.success) {
    return { status: "error", message: intent === "submit" ? "제출 전에 표시된 항목을 확인해 주세요." : "입력 내용을 확인해 주세요.", fieldErrors: fieldErrors(parsed.error), values };
  }
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_host_application", {
    p_display_name: v.displayName,
    p_contact_phone: v.contactPhone,
    p_pillar: v.pillar || null,
    p_fields: v.fields,
    p_headline: v.headline,
    p_bio: v.bio,
    p_career: v.career,
    p_credentials: v.credentials,
    p_portfolio_url: v.portfolioUrl,
    p_teaching_experience: v.teachingExperience,
    p_instagram: v.instagram,
    p_program_proposal: v.programProposal,
    p_value_to_participants: v.valueToParticipants,
    p_preferred_format: v.preferredFormat,
    p_consent: v.consent === "on",
  });
  if (error) return { status: "error", message: rpcErrorMessage(error), values };
  if (intent === "submit") {
    const { error: submitError } = await supabase.rpc("submit_host_application");
    if (submitError) return { status: "error", message: rpcErrorMessage(submitError), values };
  }
  revalidatePath("/become-a-host/apply");
  revalidatePath("/me");
  return {
    status: "success",
    message: intent === "submit" ? "지원서를 제출했어요. 운영팀이 확인한 뒤 결과를 알려 드릴게요." : "임시 저장했어요. 언제든 이어서 쓸 수 있어요.",
    values,
  };
}
