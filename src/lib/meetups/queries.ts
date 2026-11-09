import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Category = { slug: string; name: string; description: string; pillar: "knowledge" | "creators" | "experts" };

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

export type HostSummary = { user_id: string; slug: string | null; display_name: string; headline: string; is_sample: boolean };

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
  host: (HostSummary & { bio: string; expertise: string[]; instagram_handle: string | null; career: string; occupation: string; avatar_path: string | null }) | null;
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
  primary_pillar: "knowledge" | "creators" | "experts" | null;
  slug: string | null;
  occupation: string;
  philosophy: string;
  avatar_path: string | null;
  is_featured: boolean;
  featured_order: number | null;
  is_sample: boolean;
};

const HOST_DETAIL_SELECT =
  "user_id, slug, display_name, headline, bio, expertise, instagram_handle, career, credentials, portfolio_url, teaching_experience, occupation, philosophy, avatar_path, primary_pillar, is_featured, featured_order, is_sample";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CARD_SELECT =
  "id, title, summary, price, category_slug, cover_image_url, is_sample, status, host:host_profiles(user_id, slug, display_name, headline, is_sample), sessions:meetup_sessions(id, starts_at, ends_at, area, venue_name, capacity, reserved_count, status)";

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
    .select("slug, name, description, pillar")
    .order("sort_order");
  if (error) throw new Error(`카테고리 조회 실패: ${error.message}`);
  return data ?? [];
}

/** 공개된 프로그램 중 앞으로 열리는 회차가 있는 것, 가장 가까운 회차 순 */
export async function listUpcomingMeetups(opts: { category?: string; categories?: string[]; hostId?: string; limit?: number } = {}) {
  const supabase = await createSupabaseServerClient();
  // 운영을 멈춘(비활성) 카테고리의 프로그램은 목록에서 제외 — 비활성 카테고리는 RLS로 보이지 않아 inner join에서 빠짐
  let query = supabase.from("meetups").select(`${CARD_SELECT}, category:categories!inner(slug)`).eq("status", "published");
  if (opts.category) query = query.eq("category_slug", opts.category);
  if (opts.categories) query = query.in("category_slug", opts.categories);
  if (opts.hostId) query = query.eq("host_id", opts.hostId);
  const { data, error } = await query.returns<Row[]>();
  if (error) throw new Error(`프로그램 목록 조회 실패: ${error.message}`);
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
      "id, title, summary, description, price, category_slug, cover_image_url, meetup_type, is_sample, status, max_quantity_per_booking, target_audience, requirements, what_to_bring, agenda, refund_policy_text, level, learning_outcomes, materials_note, host:host_profiles(user_id, slug, display_name, headline, bio, expertise, instagram_handle, career, occupation, avatar_path, is_sample), sessions:meetup_sessions(id, starts_at, ends_at, area, venue_name, capacity, reserved_count, status)",
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(`프로그램 조회 실패: ${error.message}`);
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

/** 호스트 조회: slug 또는 (예전 주소의) 사용자 id */
export async function getHost(idOrSlug: string): Promise<HostDetail | null> {
  const isId = UUID.test(idOrSlug);
  if (!isId && !/^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/.test(idOrSlug)) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("host_profiles")
    .select(HOST_DETAIL_SELECT)
    .eq(isId ? "user_id" : "slug", idOrSlug)
    .eq("status", "approved")
    .maybeSingle();
  if (error) throw new Error(`호스트 조회 실패: ${error.message}`);
  return data;
}

export async function listFeaturedHosts(limit = 4): Promise<HostDetail[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("host_profiles")
    .select(HOST_DETAIL_SELECT)
    .eq("status", "approved")
    // 운영팀 추천(featured) 먼저 — 팔로워 수 등 인기 지표는 순서에 쓰지 않음
    .order("is_featured", { ascending: false })
    .order("featured_order", { ascending: true, nullsFirst: false })
    .order("display_name", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`호스트 목록 조회 실패: ${error.message}`);
  return data ?? [];
}

export type HostListItem = HostDetail & {
  pillars: ("knowledge" | "creators" | "experts")[];
  representative: MeetupCardData | null;
  upcomingCount: number;
};

/**
 * 호스트 목록: 승인된 호스트만 (RLS + status 조건).
 * - 분류: 대표 분류(primary_pillar) 또는 공개 중인 프로그램의 분류에 해당하면 포함
 * - 검색: 이름·한 줄 소개·전문 분야·경력 (대소문자 무시)
 * - 정렬: 다가오는 프로그램이 있는 호스트 먼저, 그다음 이름순 (팔로워 수는 쓰지 않음)
 */
export async function listHosts(opts: { pillar?: "knowledge" | "creators" | "experts"; q?: string } = {}): Promise<HostListItem[]> {
  const [hosts, meetups, categories] = await Promise.all([listFeaturedHosts(200), listUpcomingMeetups(), listCategories()]);
  const pillarOf = Object.fromEntries(categories.map((c) => [c.slug, c.pillar]));
  const q = opts.q?.trim().toLowerCase() ?? "";
  const items: HostListItem[] = hosts.map((h) => {
    const mine = meetups.filter((m) => m.host?.user_id === h.user_id);
    const pillars = Array.from(new Set([h.primary_pillar, ...mine.map((m) => pillarOf[m.category_slug])].filter(Boolean))) as HostListItem["pillars"];
    return { ...h, pillars, representative: mine[0] ?? null, upcomingCount: mine.length };
  });
  return items
    .filter((h) => !opts.pillar || h.pillars.includes(opts.pillar))
    .filter((h) => !q || [h.display_name, h.headline, h.career, ...h.expertise].some((t) => t?.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.upcomingCount > 0) - Number(a.upcomingCount > 0) || a.display_name.localeCompare(b.display_name, "ko"));
}
