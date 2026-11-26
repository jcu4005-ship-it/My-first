import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreatorApplicationRow = {
  id: string;
  applied_at: string;
  name: string;
  field: string;
  strength: string;
  experience: string;
  motivation: string;
  link_url: string | null;
  wished_activity: string | null;
  consented_at: string;
  status: string;
  status_changed_at: string;
  updated_at: string;
};

export type CreatorNoteRow = { id: number; kind: string; body: string; author_id: string | null; created_at: string };

// 연락처(contact_phone)는 일부러 뺌: 표에서 직접 읽을 수 없고 관리자 함수(admin_creator_application_contact)로만 열람
const SELECT = "id, applied_at, name, field, strength, experience, motivation, link_url, wished_activity, consented_at, status, status_changed_at, updated_at";

/** 관리자: 지원 목록 (RLS: 관리자 2단계 인증만) */
export async function listCreatorApplications(): Promise<CreatorApplicationRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("creator_applications").select(SELECT).order("applied_at", { ascending: false }).limit(500);
  if (error) throw new Error(`크리에이터 지원 목록 조회 실패: ${error.message}`);
  return (data ?? []) as CreatorApplicationRow[];
}

export async function getCreatorApplication(id: string): Promise<CreatorApplicationRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("creator_applications").select(SELECT).eq("id", id).maybeSingle();
  return data as CreatorApplicationRow | null;
}

export async function listCreatorNotes(applicationId: string): Promise<CreatorNoteRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("creator_application_notes")
    .select("id, kind, body, author_id, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  return (data ?? []) as CreatorNoteRow[];
}
