"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentMember } from "@/lib/auth/session";
import { formValue, type FormState } from "@/lib/forms";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  bookingId: z.uuid(),
  rating: z.coerce.number().int().min(1, "별점을 골라 주세요.").max(5, "별점을 골라 주세요."),
  body: z.string().trim().min(10, "후기는 10자 이상 적어 주세요.").max(1000, "후기는 1000자 이내로 적어 주세요."),
});

/** 참가 후기 쓰기 — 참가 여부·기간·중복은 DB 함수가 다시 확인 */
export async function writeReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member || member.status !== "active") return { status: "error", message: "로그인이 필요합니다." };
  const parsed = reviewSchema.safeParse({
    bookingId: formValue(formData, "bookingId"),
    rating: formValue(formData, "rating"),
    body: formValue(formData, "body"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { status: "error", message: first?.path[0] === "bookingId" ? "잘못된 요청입니다." : (first?.message ?? "입력값을 확인해 주세요.") };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("write_review", {
    p_booking_id: parsed.data.bookingId,
    p_rating: parsed.data.rating,
    p_body: parsed.data.body,
  });
  if (error) return { status: "error", message: error.code === "23505" ? "이미 후기를 남겼어요." : rpcErrorMessage(error) };
  revalidatePath("/me/reviews");
  revalidatePath("/meetups", "layout");
  revalidatePath("/hosts", "layout");
  return { status: "success", message: "후기를 남겼어요. 고마워요!" };
}
