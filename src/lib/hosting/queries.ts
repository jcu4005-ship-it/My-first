import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type HostStatus = "applied" | "approved" | "rejected" | "suspended";
export type MeetupStatus = "draft" | "pending_review" | "published" | "rejected" | "archived" | "suspended";

export const MEETUP_STATUS_LABEL: Record<MeetupStatus, string> = {
  draft: "작성 중",
  pending_review: "검수 대기",
  published: "공개 중",
  rejected: "반려",
  archived: "모집 종료",
  suspended: "운영 정지",
};

export type MyHostProfile = {
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
  slug: string | null;
  occupation: string;
  philosophy: string;
  avatar_path: string | null;
  status: HostStatus;
  review_note: string | null;
};

export async function getMyHostProfile(userId: string): Promise<MyHostProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("host_profiles")
    .select("user_id, display_name, headline, bio, expertise, instagram_handle, career, credentials, portfolio_url, teaching_experience, slug, occupation, philosophy, avatar_path, status, review_note")
    .eq("user_id", userId)
    .maybeSingle();
  return data as MyHostProfile | null;
}

export type HostMeetupRow = {
  id: string;
  title: string;
  category_slug: string;
  status: MeetupStatus;
  price: number;
  review_note: string | null;
  updated_at: string;
  sessions: { id: string; starts_at: string; capacity: number; reserved_count: number; status: string }[];
};

export async function listMyMeetups(userId: string): Promise<HostMeetupRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("meetups")
    .select("id, title, category_slug, status, price, review_note, updated_at, sessions:meetup_sessions(id, starts_at, capacity, reserved_count, status)")
    .eq("host_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`내 프로그램 조회 실패: ${error.message}`);
  return (data ?? []) as HostMeetupRow[];
}

export type EditableMeetup = {
  id: string;
  host_id: string;
  title: string;
  category_slug: string;
  meetup_type: "general" | "class" | "outdoor" | "alcohol";
  summary: string;
  description: string;
  price: number;
  max_quantity_per_booking: number;
  target_audience: string;
  requirements: string;
  what_to_bring: string;
  agenda: { time: string; title: string }[];
  refund_policy_text: string;
  level: "all" | "beginner" | "intermediate" | "advanced";
  learning_outcomes: string;
  materials_note: string;
  status: MeetupStatus;
  review_note: string | null;
  accept_coupons: boolean;
  coupons_consented_at: string | null;
  price_rationale: string;
  cover_path: string | null;
};

export async function getMyMeetup(userId: string, id: string): Promise<EditableMeetup | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("meetups")
    .select("id, host_id, title, category_slug, meetup_type, summary, description, price, max_quantity_per_booking, target_audience, requirements, what_to_bring, agenda, refund_policy_text, level, learning_outcomes, materials_note, status, review_note, accept_coupons, coupons_consented_at, price_rationale, cover_path")
    .eq("id", id)
    .eq("host_id", userId)
    .maybeSingle();
  return data as EditableMeetup | null;
}

export type HostSession = {
  id: string;
  starts_at: string;
  ends_at: string;
  area: string;
  venue_name: string;
  address_detail: string;
  capacity: number;
  reserved_count: number;
  status: "open" | "closed" | "cancelled" | "completed";
};

export type Participant = {
  booking_id: string;
  session_id: string;
  nickname: string;
  quantity: number;
  status: "confirmed" | "cancelled_by_user" | "cancelled_by_host";
  created_at: string;
};

export async function getHostSessionsAndParticipants(meetupId: string) {
  const supabase = await createSupabaseServerClient();
  const [sessions, participants] = await Promise.all([
    supabase.rpc("host_meetup_sessions", { p_meetup_id: meetupId }),
    supabase.rpc("host_meetup_participants", { p_meetup_id: meetupId }),
  ]);
  if (sessions.error) throw new Error(`일정 조회 실패: ${sessions.error.message}`);
  if (participants.error) throw new Error(`참가자 조회 실패: ${participants.error.message}`);
  return { sessions: (sessions.data ?? []) as HostSession[], participants: (participants.data ?? []) as Participant[] };
}

/* ---------- 관리자 ---------- */

export type HostApplication = MyHostProfile & {
  applied_at: string;
  reviewed_at: string | null;
  primary_pillar: "knowledge" | "creators" | "experts" | null;
  is_featured: boolean;
  featured_order: number | null;
};

export async function listHostApplications(): Promise<HostApplication[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("host_profiles")
    .select("user_id, display_name, headline, bio, expertise, instagram_handle, career, credentials, portfolio_url, teaching_experience, slug, occupation, philosophy, avatar_path, status, review_note, applied_at, reviewed_at, primary_pillar, is_featured, featured_order")
    .eq("is_sample", false)
    .order("applied_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`호스트 신청 조회 실패: ${error.message}`);
  return (data ?? []) as HostApplication[];
}

export type ReviewMeetup = EditableMeetup & {
  is_sample: boolean;
  host: { display_name: string } | null;
  sessions: { id: string; starts_at: string; area: string; venue_name: string; capacity: number; reserved_count: number; status: string }[];
};

export async function listMeetupsByStatus(status: MeetupStatus): Promise<ReviewMeetup[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("meetups")
    .select("id, host_id, title, category_slug, meetup_type, summary, description, price, max_quantity_per_booking, target_audience, requirements, what_to_bring, agenda, refund_policy_text, level, learning_outcomes, materials_note, status, review_note, is_sample, price_rationale, host:host_profiles(display_name), sessions:meetup_sessions(id, starts_at, area, venue_name, capacity, reserved_count, status)")
    .eq("status", status)
    .order("updated_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(`프로그램 조회 실패: ${error.message}`);
  return (data ?? []) as unknown as ReviewMeetup[];
}
