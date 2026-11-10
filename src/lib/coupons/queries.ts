import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CouponRow = {
  id: string;
  code: string;
  name: string;
  percent_off: number;
  first_booking_only: boolean;
  max_redemptions: number | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  used: number;
  discount_total: number;
};

/** 관리자: 쿠폰 목록 + 사용 현황 (확정·결제 대기 신청 기준). RLS로 관리자만 조회 */
export async function listCouponsForAdmin(): Promise<CouponRow[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: coupons, error }, { data: uses }] = await Promise.all([
    supabase.from("coupons").select("id, code, name, percent_off, first_booking_only, max_redemptions, starts_at, ends_at, is_active, created_at").order("created_at", { ascending: false }),
    supabase.from("bookings").select("coupon_id, discount_amount").not("coupon_id", "is", null).in("status", ["confirmed", "pending_payment"]),
  ]);
  if (error) throw new Error(`쿠폰 조회 실패: ${error.message}`);
  return (coupons ?? []).map((c) => {
    const mine = (uses ?? []).filter((u) => u.coupon_id === c.id);
    return { ...c, used: mine.length, discount_total: mine.reduce((n, u) => n + (u.discount_amount ?? 0), 0) } as CouponRow;
  });
}
