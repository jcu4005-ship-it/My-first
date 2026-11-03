"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentMember } from "@/lib/auth/session";
import { formValue, type FormState } from "@/lib/forms";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  meetupId: z.uuid(),
  sessionId: z.uuid("일정을 선택해 주세요."),
  quantity: z.coerce.number().int().min(1).max(4),
});

/** 참가 신청 — 정원·중복·인원 제한은 DB 함수가 최종 확인 (결제 없이 즉시 확정) */
export async function bookAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = schema.safeParse({
    meetupId: formValue(formData, "meetupId"),
    sessionId: formValue(formData, "sessionId"),
    quantity: formValue(formData, "quantity") || "1",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  const member = await getCurrentMember();
  if (!member) redirect(`/login?next=${encodeURIComponent(`/meetups/${parsed.data.meetupId}`)}`);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("book_session", {
    p_session_id: parsed.data.sessionId,
    p_quantity: parsed.data.quantity,
  });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  redirect(`/me/bookings?booked=${data}`);
}
