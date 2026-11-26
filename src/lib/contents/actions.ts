"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { checkAdminForAction } from "@/lib/auth/guards";
import { getCurrentMember } from "@/lib/auth/session";
import { formValue, type FormState } from "@/lib/forms";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/auth";
import { CONTENT_KEYS, contentDraftSchema, contentReadySchema } from "@/lib/validation/content";

import { CONTENT_COVER_BUCKET } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_ALLOWED: FormState = { status: "error", message: "승인된 호스트나 관리자만 콘텐츠를 쓸 수 있어요." };

function revalidateContent(slug?: string) {
  revalidatePath("/journal");
  if (slug) revalidatePath(`/journal/${slug}`);
  revalidatePath("/host/contents");
  revalidatePath("/admin/contents");
}

/**
 * 콘텐츠 저장 / 검토 요청(호스트) / 바로 공개(관리자 본인 글).
 * 권한은 화면·이 서버 처리·DB 함수에서 각각 확인합니다.
 */
export async function saveContentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const intent = formValue(formData, "intent");
  const scope = formValue(formData, "scope") === "admin" ? "admin" : "host";
  const member = scope === "admin" ? await checkAdminForAction() : await getCurrentMember();
  if (!member || member.status !== "active") return NOT_ALLOWED;
  if (scope === "host" && !member.roles.includes("host")) return NOT_ALLOWED;

  const values = Object.fromEntries(CONTENT_KEYS.map((k) => [k, formValue(formData, k)]));
  const schema = intent === "save" ? contentDraftSchema : contentReadySchema;
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", message: "표시된 항목을 확인해 주세요.", fieldErrors: fieldErrors(parsed.error), values };
  }
  const v = parsed.data;
  if (v.coverPath && !v.coverPath.startsWith(`${member.id}/`)) {
    return { status: "error", message: "본인이 올린 사진만 사용할 수 있어요.", values };
  }

  const supabase = await createSupabaseServerClient();
  const before = v.contentId
    ? (await supabase.from("contents").select("cover_path, slug").eq("id", v.contentId).eq("author_id", member.id).maybeSingle()).data
    : null;
  const { data: id, error } = await supabase.rpc("save_content", {
    p_id: v.contentId || null,
    p_type: v.type,
    p_title: v.title,
    p_summary: v.summary,
    p_body: v.body,
    p_cover_path: v.coverPath || null,
    p_host_id: scope === "admin" ? v.hostId || null : null,
    p_related_meetup_id: v.relatedMeetupId || null,
  });
  if (error || typeof id !== "string") return { status: "error", message: rpcErrorMessage(error) || "저장하지 못했어요.", values };
  // 사진을 바꿨거나 지웠으면 예전 파일 정리 (본인 폴더만 지울 수 있음)
  if (before?.cover_path && before.cover_path !== (v.coverPath || null)) {
    await supabase.storage.from(CONTENT_COVER_BUCKET).remove([before.cover_path]);
  }

  let message = "저장했어요.";
  if (intent === "submit") {
    const { error: e2 } = await supabase.rpc("submit_content", { p_id: id });
    if (e2) return { status: "error", message: rpcErrorMessage(e2), values: { ...values, contentId: id } };
    message = "검토를 요청했어요. 운영팀이 확인한 뒤 공개돼요.";
  } else if (intent === "publish" && scope === "admin") {
    const { error: e2 } = await supabase.rpc("admin_review_content", { p_id: id, p_action: "publish", p_note: null });
    if (e2) return { status: "error", message: rpcErrorMessage(e2), values: { ...values, contentId: id } };
    message = "공개했어요.";
  }
  revalidateContent(before?.slug);
  const base = scope === "admin" ? "/admin/contents" : "/host/contents";
  if (!v.contentId) redirect(`${base}/${id}?saved=1`);
  revalidatePath(`${base}/${id}`);
  return { status: "success", message };
}

/** 작성자 본인: 작성 중·보완 요청·비공개 글 지우기 */
export async function deleteContentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member) return { status: "error", message: "로그인이 필요합니다." };
  const id = formValue(formData, "contentId");
  const scope = formValue(formData, "scope") === "admin" ? "admin" : "host";
  if (!UUID.test(id)) return { status: "error", message: "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("contents").select("cover_path").eq("id", id).eq("author_id", member.id).maybeSingle();
  const { error } = await supabase.rpc("delete_my_content", { p_id: id });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  if (before?.cover_path) await supabase.storage.from(CONTENT_COVER_BUCKET).remove([before.cover_path]);
  revalidateContent();
  redirect(scope === "admin" ? "/admin/contents?tab=mine" : "/host/contents");
}

const reviewSchema = z.object({
  contentId: z.string().regex(UUID),
  action: z.enum(["publish", "reject", "unpublish"]),
  note: z.string().trim().max(500),
});

/** 관리자: 공개 / 보완 요청(반려) / 내리기 — 감사 기록·알림은 DB 함수가 남김 */
export async function reviewContentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return { status: "error", message: "관리자 2단계 인증이 필요합니다. 다시 로그인해 주세요." };
  const parsed = reviewSchema.safeParse({
    contentId: formValue(formData, "contentId"),
    action: formValue(formData, "action"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return { status: "error", message: "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_review_content", {
    p_id: parsed.data.contentId,
    p_action: parsed.data.action,
    p_note: parsed.data.note || null,
  });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  const { data } = await supabase.from("contents").select("slug").eq("id", parsed.data.contentId).maybeSingle();
  revalidateContent(data?.slug);
  revalidatePath(`/admin/contents/${parsed.data.contentId}`);
  const done = { publish: "공개했어요.", reject: "보완을 요청했어요.", unpublish: "비공개로 내렸어요." } as const;
  return { status: "success", message: done[parsed.data.action] };
}
