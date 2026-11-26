import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { SupportCategory, SupportStatus } from "./types";

export type SupportTicket = {
  id: string;
  user_id: string;
  category: SupportCategory;
  subject: string;
  booking_id: string | null;
  status: SupportStatus;
  created_at: string;
  last_message_at: string;
};
export type SupportMessage = { id: string; from_staff: boolean; body: string; created_at: string };

const TICKET = "id, user_id, category, subject, booking_id, status, created_at, last_message_at";

/** 내 문의 목록 (RLS: 본인 것만) */
export async function listMyTickets(userId: string): Promise<SupportTicket[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("support_tickets").select(TICKET).eq("user_id", userId).order("last_message_at", { ascending: false });
  if (error) throw new Error(`문의 조회 실패: ${error.message}`);
  return (data ?? []) as SupportTicket[];
}

/** 문의 한 건 + 대화 (RLS: 본인 또는 관리자만. 없으면 null) */
export async function getTicket(id: string): Promise<{ ticket: SupportTicket; messages: SupportMessage[]; booking: { title: string; starts_at: string; status: string } | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data: ticket } = await supabase.from("support_tickets").select(TICKET).eq("id", id).maybeSingle();
  if (!ticket) return null;
  const { data: messages } = await supabase.from("support_messages").select("id, from_staff, body, created_at").eq("ticket_id", id).order("created_at");
  let booking = null;
  if (ticket.booking_id) {
    const { data: b } = await supabase
      .from("bookings")
      .select("status, session:meetup_sessions(starts_at, meetup:meetups(title))")
      .eq("id", ticket.booking_id)
      .maybeSingle();
    const s = (b?.session ?? null) as unknown as { starts_at: string; meetup: { title: string } | null } | null;
    if (b && s) booking = { title: s.meetup?.title ?? "프로그램", starts_at: s.starts_at, status: b.status as string };
  }
  return { ticket: ticket as SupportTicket, messages: (messages ?? []) as SupportMessage[], booking };
}

/** 관리자: 상태별 문의 목록 + 회원 닉네임 (RLS: 관리자 2단계 인증) */
export async function listTicketsForAdmin(status?: SupportStatus): Promise<(SupportTicket & { nickname: string })[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase.from("support_tickets").select(TICKET).order("last_message_at", { ascending: false }).limit(200);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(`문의 조회 실패: ${error.message}`);
  const tickets = (data ?? []) as SupportTicket[];
  const ids = [...new Set(tickets.map((t) => t.user_id))];
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, nickname").in("id", ids) : { data: [] };
  const names = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.nickname]));
  return tickets.map((t) => ({ ...t, nickname: names[t.user_id] ?? "(알 수 없음)" }));
}

