import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MyWaitlistItem = {
  session_id: string;
  meetup_id: string;
  title: string;
  starts_at: string;
  left_seats: number;
  notified_at: string | null;
  created_at: string;
};

/** 내 대기 목록 (다가오는 일정만). 로그인하지 않았으면 빈 목록 */
export async function listMyWaitlist(): Promise<MyWaitlistItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("my_waitlist");
  return (data as MyWaitlistItem[] | null) ?? [];
}
