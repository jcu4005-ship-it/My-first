import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/** 서비스 설정 (비공개 베타 장치). DB 값을 읽지 못하면 안전한 쪽(초대제 켬·유료 막음)으로 봄 */
export type AppSettings = { invite_only: boolean; paid_bookings_enabled: boolean };

const SAFE_DEFAULT: AppSettings = { invite_only: true, paid_bookings_enabled: false };

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("app_settings").select("invite_only, paid_bookings_enabled").maybeSingle();
  if (error || !data) return SAFE_DEFAULT;
  return data;
}

export type InviteCodeRow = {
  id: string;
  code: string;
  note: string;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
};

/** 관리자 전용 (RLS: 관리자 2단계 인증만 조회) */
export async function listInviteCodes(): Promise<InviteCodeRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invite_codes")
    .select("id, code, note, max_uses, used_count, is_active, expires_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`초대 코드 조회 실패: ${error.message}`);
  return data ?? [];
}
