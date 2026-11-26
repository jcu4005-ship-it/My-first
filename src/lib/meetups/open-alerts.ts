import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MyOpenAlert = { session_id: string; meetup_id: string; title: string; starts_at: string; opens_at: string };

/** 내가 "열리면 알림 받기"를 켠, 아직 열리지 않은 일정. 로그인하지 않았으면 빈 목록 */
export async function listMyOpenAlerts(): Promise<MyOpenAlert[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("my_open_alerts");
  return (data as MyOpenAlert[] | null) ?? [];
}
