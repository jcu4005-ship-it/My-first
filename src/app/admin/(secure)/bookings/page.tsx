import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/guards";
import { formatPrice, formatShortDateTime } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "신청 현황" };
export const instant = false;

const STATUS_LABEL: Record<string, string> = {
  confirmed: "확정",
  pending_payment: "결제 대기",
  cancelled_by_user: "참가자 취소",
  cancelled_by_host: "호스트 취소",
  expired: "만료",
};
const FILTERS = ["confirmed", "pending_payment", "cancelled_by_user", "cancelled_by_host"] as const;

type Row = {
  booking_id: string;
  created_at: string;
  status: string;
  quantity: number;
  total_price: number;
  nickname: string;
  meetup_id: string;
  title: string;
  host_name: string;
  starts_at: string;
  attended: boolean | null;
};

/** 최근 신청 200건 — 개인정보는 닉네임만 보여요. 결제·환불 처리는 이 화면에서 하지 않아요. */
export default async function AdminBookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requireAdmin("/admin/bookings");
  const raw = (await searchParams).status;
  const status = typeof raw === "string" && (FILTERS as readonly string[]).includes(raw) ? raw : null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("admin_recent_bookings", { p_status: status });
  const rows = (data as Row[] | null) ?? [];
  return (
    <div data-testid="admin-bookings">
      <h1 className="font-display text-3xl font-bold">신청 현황</h1>
      <p className="mt-2 text-sm text-muted-foreground">최근 신청 200건. 참가자는 닉네임만 보여요.</p>
      <nav className="mt-5 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/bookings" className={`rounded-full border px-3 py-1 ${status ? "" : "border-foreground font-semibold"}`}>전체</Link>
        {FILTERS.map((f) => (
          <Link key={f} href={`/admin/bookings?status=${f}`} className={`rounded-full border px-3 py-1 ${status === f ? "border-foreground font-semibold" : ""}`}>
            {STATUS_LABEL[f]}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">신청이 없어요.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border" tabIndex={0} role="region" aria-label="신청 목록 표 (좌우로 스크롤)">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">신청 시각</th>
                <th className="px-3 py-2 font-medium">프로그램 · 일정</th>
                <th className="px-3 py-2 font-medium">참가자</th>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-3 py-2 text-right font-medium">금액</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.booking_id} data-testid="admin-booking-row">
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatShortDateTime(r.created_at)}</td>
                  <td className="px-3 py-2.5">
                    <Link href={`/meetups/${r.meetup_id}`} className="font-medium hover:underline">{r.title}</Link>
                    <span className="block text-xs text-muted-foreground">{r.host_name} · {formatShortDateTime(r.starts_at)}</span>
                  </td>
                  <td className="px-3 py-2.5">{r.nickname}{r.quantity > 1 ? ` 외 ${r.quantity - 1}명` : ""}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {STATUS_LABEL[r.status] ?? r.status}
                    {r.attended != null && <span className="ml-1 text-xs text-muted-foreground">· {r.attended ? "참석" : "불참"}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatPrice(r.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
