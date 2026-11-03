"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { formValue, type FormState } from "@/lib/forms";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function cancelBookingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formValue(formData, "bookingId"));
  if (!id.success) return { status: "error", message: "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_booking", { p_booking_id: id.data });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  revalidatePath("/me/bookings");
  return { status: "success", message: "신청을 취소했어요." };
}
