"use server";

import { z } from "zod";

import { getCurrentMember } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SavedItem = { id: string; title: string; meta: string };

/** 저장 버튼 → 로그인했으면 계정에도 반영 (로그인 전에는 이 기기에만) */
export async function toggleSaveAction(meetupId: string, saved: boolean): Promise<{ synced: boolean }> {
  if (!z.uuid().safeParse(meetupId).success) return { synced: false };
  const member = await getCurrentMember();
  if (!member || member.status !== "active") return { synced: false };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_meetup_saved", { p_meetup_id: meetupId, p_saved: saved });
  return { synced: !error };
}

/** 로그인한 기기에서 한 번: 이 기기에만 있던 저장을 계정에 올리고, 계정의 전체 목록을 돌려줌 */
export async function syncSavesAction(localIds: string[]): Promise<SavedItem[] | null> {
  const member = await getCurrentMember();
  if (!member || member.status !== "active") return null;
  const supabase = await createSupabaseServerClient();
  const ids = Array.from(new Set(localIds.filter((id) => z.uuid().safeParse(id).success))).slice(0, 60);
  await Promise.all(ids.map((id) => supabase.rpc("set_meetup_saved", { p_meetup_id: id, p_saved: true })));
  return listMySavedMeetups();
}

/** 계정에 저장된 목록 (로그인한 회원만) */
export async function listMySavedMeetups(): Promise<SavedItem[] | null> {
  const member = await getCurrentMember();
  if (!member || member.status !== "active") return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_saved_meetups");
  if (error) return null;
  return ((data as { meetup_id: string; title: string; next_starts_at: string | null; area: string | null }[] | null) ?? []).map((r) => ({
    id: r.meetup_id,
    title: r.title,
    meta: r.next_starts_at ? `${formatDate(r.next_starts_at)} · ${r.area ?? ""}` : "예정된 일정 없음",
  }));
}
