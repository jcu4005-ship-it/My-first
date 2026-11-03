"use server";

import { revalidatePath } from "next/cache";

import { getCurrentMember } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function markAllReadAction(): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member) return { status: "error", message: "로그인이 필요합니다." };
  const supabase = await createSupabaseServerClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", member.id).is("read_at", null);
  revalidatePath("/me/notifications");
  return { status: "success", message: "모두 읽음으로 표시했어요." };
}
