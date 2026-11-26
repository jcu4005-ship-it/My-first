"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentMember } from "@/lib/auth/session";
import { formValue, type FormState } from "@/lib/forms";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import { SUPPORT_CATEGORIES } from "@/lib/support/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/auth";

const ticketSchema = z.object({
  category: z.enum(SUPPORT_CATEGORIES.map((c) => c.value) as [string, ...string[]], { message: "문의 분야를 골라 주세요." }),
  subject: z.string().trim().min(2, "제목을 2자 이상 적어 주세요.").max(80, "제목은 80자까지예요."),
  body: z.string().trim().min(5, "내용을 5자 이상 적어 주세요.").max(2000, "내용은 2000자까지예요."),
  bookingId: z.union([z.literal(""), z.uuid()]).optional().default(""),
});

/** 1:1 문의 남기기 — 본인 신청 연결 여부·도배 방지는 DB 함수가 다시 확인 */
export async function createTicketAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member || member.status !== "active") return { status: "error", message: "로그인이 필요합니다." };
  const raw = { category: formValue(formData, "category"), subject: formValue(formData, "subject"), body: formValue(formData, "body"), bookingId: formValue(formData, "bookingId") };
  const parsed = ticketSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_support_ticket", {
    p_category: parsed.data.category as "booking",
    p_subject: parsed.data.subject,
    p_body: parsed.data.body,
    p_booking_id: (parsed.data.bookingId || null) as string,
  });
  if (error || typeof data !== "string") return { status: "error", message: rpcErrorMessage(error), values: raw };
  revalidatePath("/me/support");
  redirect(`/me/support/${data}?sent=1`);
}

const messageSchema = z.object({
  ticketId: z.uuid(),
  body: z.string().trim().min(5, "내용을 5자 이상 적어 주세요.").max(2000, "내용은 2000자까지예요."),
});

/** 내 문의에 이어서 적기 */
export async function addSupportMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member || member.status !== "active") return { status: "error", message: "로그인이 필요합니다." };
  const raw = { ticketId: formValue(formData, "ticketId"), body: formValue(formData, "body") };
  const parsed = messageSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_support_message", { p_ticket_id: parsed.data.ticketId, p_body: parsed.data.body });
  if (error) return { status: "error", message: rpcErrorMessage(error), values: raw };
  revalidatePath(`/me/support/${parsed.data.ticketId}`);
  return { status: "success", message: "추가 내용을 보냈어요. 운영팀이 확인하는 대로 답변드릴게요." };
}
