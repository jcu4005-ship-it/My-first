"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentMember } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ hostId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i), intent: z.enum(["follow", "unfollow"]), path: z.string().regex(/^\/(hosts\/[a-z0-9-]+|meetups\/[0-9a-f-]{36})$/i) });

/** 팔로우/취소 — 로그인·승인 호스트·자기 자신 여부는 DB 함수가 다시 확인 */
export async function toggleFollowAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member || member.status !== "active") return { status: "error", message: "로그인이 필요합니다." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "잘못된 요청입니다." };
  const { hostId, intent, path } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(intent === "follow" ? "follow_host" : "unfollow_host", { p_host_id: hostId });
  if (error) {
    return { status: "error", message: error.code === "22023" ? "자기 자신은 팔로우할 수 없어요." : "처리하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  revalidatePath(path);
  revalidatePath("/me");
  return { status: "success", message: intent === "follow" ? "팔로우했어요. 새 프로그램 소식을 마이페이지에서 볼 수 있어요." : "팔로우를 취소했어요." };
}
