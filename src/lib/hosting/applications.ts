import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ApplicationStatus = "draft" | "submitted" | "reviewing" | "revision_requested" | "approved" | "rejected";

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: "작성 중",
  submitted: "제출 완료",
  reviewing: "심사 중",
  revision_requested: "수정 요청",
  approved: "승인",
  rejected: "반려",
};

export type HostApplicationRow = {
  id: string;
  applicant_id: string;
  status: ApplicationStatus;
  display_name: string;
  contact_phone: string;
  pillar: "knowledge" | "creators" | "experts" | null;
  fields: string[];
  headline: string;
  bio: string;
  career: string;
  credentials: string;
  portfolio_url: string | null;
  teaching_experience: string;
  instagram_handle: string | null;
  program_proposal: string;
  value_to_participants: string;
  preferred_format: string;
  consented_at: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT =
  "id, applicant_id, status, display_name, contact_phone, pillar, fields, headline, bio, career, credentials, portfolio_url, teaching_experience, instagram_handle, program_proposal, value_to_participants, preferred_format, consented_at, review_note, reviewed_at, submitted_at, created_at, updated_at";

/** 내 지원서: 진행 중인 것 우선, 없으면 가장 최근 것 (RLS: 본인 것만) */
export async function getMyApplication(userId: string): Promise<HostApplicationRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("host_applications")
    .select(SELECT)
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(`지원서 조회 실패: ${error.message}`);
  const rows = (data ?? []) as HostApplicationRow[];
  return rows.find((r) => ["draft", "submitted", "reviewing", "revision_requested"].includes(r.status)) ?? rows[0] ?? null;
}

/** 관리자: 지원서 목록 (RLS: 관리자 2단계 인증) */
export async function listApplicationsForAdmin(status?: ApplicationStatus): Promise<HostApplicationRow[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase.from("host_applications").select(SELECT).neq("status", "draft").order("submitted_at", { ascending: false, nullsFirst: false }).limit(200);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(`지원서 목록 조회 실패: ${error.message}`);
  return (data ?? []) as HostApplicationRow[];
}

export async function getApplicationForAdmin(id: string): Promise<HostApplicationRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("host_applications").select(SELECT).eq("id", id).maybeSingle();
  return data as HostApplicationRow | null;
}

export type ApplicationEvent = { id: number; action: string; reason: string | null; created_at: string; after: { status?: string } | null };

/** 지원서 처리 이력 (감사 기록) */
export async function listApplicationHistory(id: string): Promise<ApplicationEvent[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, reason, created_at, after")
    .eq("target_type", "host_application")
    .eq("target_id", id)
    .order("created_at", { ascending: true });
  return (data ?? []) as ApplicationEvent[];
}

export type HostEvent = { id: number; action: string; reason: string | null; created_at: string; target_type: string };

/** 관리자: 한 호스트의 처리 이력 (지원서 심사 + 호스트 상태·노출·주소 변경) */
export async function listHostHistory(userId: string): Promise<HostEvent[]> {
  const supabase = await createSupabaseServerClient();
  const { data: apps } = await supabase.from("host_applications").select("id").eq("applicant_id", userId);
  const appIds = (apps ?? []).map((a) => a.id as string);
  const filter = [`and(target_type.eq.host,target_id.eq.${userId})`, ...(appIds.length ? [`and(target_type.eq.host_application,target_id.in.(${appIds.join(",")}))`] : [])];
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, reason, created_at, target_type")
    .or(filter.join(","))
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as HostEvent[];
}

/** 관리자: 호스트의 예정된 참가 신청 수 (활동 중지 전 확인용) */
export async function countUpcomingActiveBookings(hostId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("bookings")
    .select("id, session:meetup_sessions!inner(starts_at, meetup:meetups!inner(host_id))", { count: "exact", head: true })
    .in("status", ["confirmed", "pending_payment"])
    .eq("session.meetup.host_id", hostId)
    .gt("session.starts_at", new Date().toISOString());
  return count ?? 0;
}
