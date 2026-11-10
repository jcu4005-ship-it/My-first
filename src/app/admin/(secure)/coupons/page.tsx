import type { Metadata } from "next";

import { ActionForm } from "@/components/forms/action-form";
import { StatusPill } from "@/components/forms/controls";
import { requireAdmin } from "@/lib/auth/guards";
import { listCouponsForAdmin } from "@/lib/coupons/queries";
import { formatPrice } from "@/lib/format";

import { setCouponActiveAction } from "../actions";

import { CouponForm } from "./coupon-form";

export const metadata: Metadata = { title: "쿠폰" };
export const instant = false;

export default async function AdminCouponsPage() {
  await requireAdmin("/admin/coupons");
  const coupons = await listCouponsForAdmin();
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl font-bold">참가자 할인 쿠폰</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          첫 1년 동안 수수료 대신 쓰는 할인이에요. 할인은 호스트가 부담하고, 호스트가 프로그램마다 동의해야 적용돼요. 할인율은 최대 10%예요.
        </p>
      </div>
      <CouponForm />
      {coupons.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="empty-state">아직 만든 쿠폰이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {coupons.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="coupon-row" data-code={c.code}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{c.code}</span>
                  <StatusPill tone={c.is_active ? "ok" : "muted"}>{c.is_active ? "사용 중" : "꺼짐"}</StatusPill>
                </div>
                <p className="mt-1 text-sm">{c.name} · {c.percent_off}% 할인{c.first_booking_only ? " · 첫 참여 전용" : ""}</p>
                <p className="mt-1 text-xs text-muted-foreground" data-testid="coupon-usage">
                  사용 {c.used}{c.max_redemptions ? ` / ${c.max_redemptions}` : ""}회 · 할인 합계 {formatPrice(c.discount_total)}
                  {c.ends_at ? ` · ${new Date(c.ends_at).toLocaleDateString("ko-KR")}까지` : ""}
                </p>
              </div>
              <ActionForm action={setCouponActiveAction} hidden={{ couponId: c.id, active: c.is_active ? "false" : "true" }}
                label={c.is_active ? "끄기" : "다시 켜기"} testId="coupon-toggle" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
