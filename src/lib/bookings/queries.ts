import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MyBooking = {
  booking_id: string;
  status: "confirmed" | "pending_payment" | "cancelled_by_user" | "cancelled_by_host" | "expired";
  quantity: number;
  total_price: number;
  created_at: string;
  cancelled_at: string | null;
  session_id: string;
  starts_at: string;
  ends_at: string;
  area: string;
  venue_name: string;
  address_detail: string | null;
  meetup_id: string;
  title: string;
  category_slug: string;
  is_sample: boolean;
  host_id: string;
  host_name: string;
  hold_expires_at: string | null;
  payment_status: "ready" | "paid" | "cancelled" | "refunded" | "failed" | null;
  refunded_amount: number | null;
};

export async function listMyBookings(): Promise<MyBooking[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_bookings");
  if (error) throw new Error(`신청 내역 조회 실패: ${error.message}`);
  return (data ?? []) as MyBooking[];
}

/** 이 일정들 중 내가 확정 신청한 일정 ID */
export async function myConfirmedSessionIds(userId: string, sessionIds: string[]): Promise<Set<string>> {
  if (!sessionIds.length) return new Set();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("bookings")
    .select("session_id")
    .eq("status", "confirmed")
    .eq("user_id", userId)
    .in("session_id", sessionIds);
  return new Set((data ?? []).map((r) => r.session_id as string));
}
