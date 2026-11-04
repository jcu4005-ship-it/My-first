import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Category = { slug: string; name: string; description: string };

export type Session = {
  id: string;
  starts_at: string;
  ends_at: string;
  area: string;
  venue_name: string;
  capacity: number;
  reserved_count: number;
  status: "open" | "closed" | "cancelled" | "completed";
};

export type HostSummary = { user_id: string; display_name: string; headline: string; is_sample: boolean };

export type MeetupCardData = {
  id: string;
  title: string;
  summary: string;
  price: number;
  category_slug: string;
  cover_image_url: string | null;
  is_sample: boolean;
  host: HostSummary | null;
  nextSession: Session;
  upcomingSessions: Session[];
};

export type MeetupDetail = MeetupCardData & {
  description: string;
  meetup_type: string;
  max_quantity_per_booking: number;
  target_audience: string;
  requirements: string;
  what_to_bring: string;
  agenda: { time: string; title: string }[];
  refund_policy_text: string;
  level: "all" | "beginner" | "intermediate" | "advanced";
  learning_outcomes: string;
  materials_note: string;
  host: (HostSummary & { bio: string; expertise: string[]; instagram_handle: string | null; career: string }) | null;
};

export type HostDetail = {
  user_id: string;
  display_name: string;
  headline: string;
  bio: string;
  expertise: string[];
  instagram_handle: string | null;
  career: string;
  credentials: string;
  portfolio_url: string | null;
  teaching_experience: string;
  is_sample: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CARD_SELECT =
  "id, title, summary, price, category_slug, cover_image_url, is_sample, status, host:host_profiles(user_id, display_name, headline, is_sample), sessions:meetup_sessions(id, starts_at, ends_at, area, venue_name, capacity, reserved_count, status)";

type Row = {
  id: string;
  title: string;
  summary: string;
  price: number;
  category_slug: string;
  cover_image_url: string | null;
  is_sample: boolean;
  host: HostSummary | null;
  sessions: Session[] | null;
};

/** 앞으로 열리는(취소되지 않은) 회차만, 시작 시각 순 */
function upcoming(sessions: Session[] | null): Session[] {
  const now = Date.now();
  return (sessions ?? [])
    .filter((s) => s.status !== "cancelled" && new Date(s.starts_at).getTime() > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

function toCard(row: Row): MeetupCardData | null {
  const sessions = upcoming(row.sessions);
  if (sessions.length === 0) return null;
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    price: row.price,
    category_slug: row.category_slug,
    cover_image_url: row.cover_image_url,
    is_sample: row.is_sample,
    host: row.host,
    nextSession: sessions[0],
    upcomingSessions: sessions,
  };
}

export async function listCategories(): Promise<Category[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("slug, name, description")
    .order("sort_order");
  if (error) throw new Error(`카테고리 조회 실패: ${error.message}`);
  return data ?? [];
}

/** 공개된 클래스 중 앞으로 열리는 회차가 있는 것, 가장 가까운 회차 순 */
export async function listUpcomingMeetups(opts: { category?: string; hostId?: string; limit?: number } = {}) {
  const supabase = await createSupabaseServerClient();
  // 운영을 멈춘(비활성) 카테고리의 클래스는 목록에서 제외 — 비활성 카테고리는 RLS로 보이지 않아 inner join에서 빠짐
  let query = supabase.from("meetups").select(`${CARD_SELECT}, category:categories!inner(slug)`).eq("status", "published");
  if (opts.category) query = query.eq("category_slug", opts.category);
  if (opts.hostId) query = query.eq("host_id", opts.hostId);
  const { data, error } = await query.returns<Row[]>();
  if (error) throw new Error(`클래스 목록 조회 실패: ${error.message}`);
  const cards = (data ?? [])
    .map(toCard)
    .filter((c): c is MeetupCardData => c !== null)
    .sort((a, b) => a.nextSession.starts_at.localeCompare(b.nextSession.starts_at));
  return opts.limit ? cards.slice(0, opts.limit) : cards;
}

export async function getMeetup(id: string): Promise<MeetupDetail | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("meetups")
    .select(
      "id, title, summary, description, price, category_slug, cover_image_url, meetup_type, is_sample, status, max_quantity_per_booking, target_audience, requirements, what_to_bring, agenda, refund_policy_text, level, learning_outcomes, materials_note, host:host_profiles(user_id, display_name, headline, bio, expertise, instagram_handle, career, is_sample), sessions:meetup_sessions(id, starts_at, ends_at, area, venue_name, capacity, reserved_count, status)",
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(`클래스 조회 실패: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as Row & Omit<MeetupDetail, keyof MeetupCardData> & { host: MeetupDetail["host"] };
  const sessions = upcoming(row.sessions);
  return {
    ...row,
    agenda: Array.isArray(row.agenda) ? row.agenda : [],
    nextSession: sessions[0] ?? null,
    upcomingSessions: sessions,
  } as MeetupDetail;
}

export async function getHost(userId: string): Promise<HostDetail | null> {
  if (!UUID.test(userId)) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("host_profiles")
    .select("user_id, display_name, headline, bio, expertise, instagram_handle, career, credentials, portfolio_url, teaching_experience, is_sample")
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  if (error) throw new Error(`호스트 조회 실패: ${error.message}`);
  return data;
}

export async function listFeaturedHosts(limit = 4): Promise<HostDetail[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("host_profiles")
    .select("user_id, display_name, headline, bio, expertise, instagram_handle, career, credentials, portfolio_url, teaching_experience, is_sample")
    .eq("status", "approved")
    .limit(limit);
  if (error) throw new Error(`호스트 목록 조회 실패: ${error.message}`);
  return data ?? [];
}
