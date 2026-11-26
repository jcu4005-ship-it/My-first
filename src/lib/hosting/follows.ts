import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listUpcomingMeetups, type HostDetail, type MeetupCardData } from "@/lib/meetups/queries";

const HOST_SELECT =
  "user_id, slug, display_name, headline, bio, expertise, instagram_handle, career, credentials, portfolio_url, teaching_experience, occupation, philosophy, avatar_path, primary_pillar, is_featured, featured_order, is_sample";

/** 호스트 페이지용: 공개 팔로워 수 + (로그인했다면) 내가 팔로우 중인지 */
export async function getFollowState(hostId: string, memberId: string | null) {
  const supabase = await createSupabaseServerClient();
  const [{ data: count }, mine] = await Promise.all([
    supabase.rpc("host_follower_count", { p_host_id: hostId }),
    memberId
      ? supabase.from("host_follows").select("host_id").eq("follower_id", memberId).eq("host_id", hostId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { count: typeof count === "number" ? count : 0, following: Boolean(mine.data) };
}

export type FollowedHost = { host: HostDetail; next: MeetupCardData | null; followedAt: string };

/** 마이페이지용: 내가 팔로우한 호스트(승인 상태만 보임) + 각 호스트의 가장 가까운 프로그램 */
export async function listMyFollowedHosts(memberId: string): Promise<FollowedHost[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("host_follows")
    .select(`created_at, host:host_profiles(${HOST_SELECT})`)
    .eq("follower_id", memberId)
    .order("created_at", { ascending: false })
    .returns<{ created_at: string; host: HostDetail | null }[]>();
  if (error) throw new Error(`팔로우 목록 조회 실패: ${error.message}`);
  const rows = (data ?? []).filter((r): r is { created_at: string; host: HostDetail } => r.host !== null);
  if (rows.length === 0) return [];
  const meetups = await listUpcomingMeetups({ hostIds: rows.map((r) => r.host.user_id) });
  return rows.map((r) => ({
    host: r.host,
    followedAt: r.created_at,
    next: meetups.find((m) => m.host?.user_id === r.host.user_id) ?? null,
  }));
}
