import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { brand } from "@/config/brand";
import { SiteHeader } from "@/components/site-header";
import { requireActiveMember } from "@/lib/auth/guards";
import { formatPrice, formatShortDateTime, formatYmd } from "@/lib/format";
import { percentLabel } from "@/lib/settings/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "정산" };
export const instant = false;

type Row = {
  id: string;
  meetup_title: string;
  starts_at: string;
  gross_amount: number;
  commission_rate_bp: number;
  commission_amount: number;
  net_amount: number;
  status: "pending" | "confirmed" | "paid" | "cancelled";
  eligible_at: string;
  confirmed_at: string | null;
  paid_at: string | null;
  mode: string;
};
type Commission = { rate_bp: number; standard_rate_bp: number; free_until: string };

const STATUS_LABEL = { pending: "정산 대기", confirmed: "정산 확정", paid: "지급 완료", cancelled: "환불로 취소" } as const;

export default async function HostSettlementsPage() {
  const member = await requireActiveMember("/host/settlements");
  if (!member.roles.includes("host")) redirect("/become-a-host/apply");
  const supabase = await createSupabaseServerClient();
  const [{ data }, { data: c }] = await Promise.all([supabase.rpc("host_my_settlements"), supabase.rpc("host_my_commission")]);
  const rows = (data as Row[] | null) ?? [];
  const com = (c as Commission[] | null)?.[0];
  const live = rows.filter((r) => r.status !== "cancelled");
  const sum = (k: "gross_amount" | "commission_amount" | "net_amount", st?: Row["status"]) =>
    live.filter((r) => !st || r.status === st).reduce((n, r) => n + r[k], 0);
  const freeNow = com ? new Date(com.free_until) > new Date() : false;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8" data-testid="host-settlements">
        <Link href="/host" className="text-sm text-muted-foreground">← 호스트 홈</Link>
        <h1 className="mt-3 font-display text-3xl font-bold">정산</h1>

        <section className="mt-5 rounded-2xl bg-card p-5 text-sm leading-relaxed" data-testid="commission-info">
          <p>
            참가비는 모두 {brand.name} 결제로 받고, <b>수수료를 뺀 금액</b>을 정산해 드려요. 수수료율은 결제되는 순간의 비율로 고정돼요.
          </p>
          {com && (
            <p className="mt-2">
              지금 내 수수료율 <b className="text-ember" data-testid="my-rate">{percentLabel(com.rate_bp)}</b>
              {freeNow ? (
                <> · 승인 후 수수료 0% 기간 (<b>{formatYmd(com.free_until)}</b>까지, 이후 {percentLabel(com.standard_rate_bp)})</>
              ) : (
                <> · 기본 수수료율</>
              )}
            </p>
          )}
          <p className="mt-2 text-muted-foreground">
            정산 확정은 프로그램이 끝나고 7일 뒤(환불·문의 확인 기간)에 운영팀이 해요. 지급은 확정 후 정해진 날짜에 이뤄져요.
          </p>
          <p className="mt-2 rounded-xl bg-notice px-3 py-2 text-notice-foreground">
            지금은 테스트 결제만 운영 중이라 아래 금액은 실제로 지급되지 않아요.
          </p>
        </section>

        <ul className="mt-5 grid grid-cols-3 gap-2.5" data-testid="settlement-totals">
          {[
            { label: "참가비 합계", value: sum("gross_amount") },
            { label: "수수료", value: sum("commission_amount") },
            { label: "받을 금액", value: sum("net_amount"), strong: true },
          ].map((x) => (
            <li key={x.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{x.label}</p>
              <p className={`mt-1 text-lg font-bold tabular-nums sm:text-2xl ${x.strong ? "text-forest" : ""}`}>{formatPrice(x.value)}</p>
            </li>
          ))}
        </ul>

        {rows.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground" data-testid="settlements-empty">
            아직 결제된 신청이 없어요. 무료 프로그램은 정산할 금액이 없어요.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border" tabIndex={0} role="region" aria-label="정산 목록 표 (좌우로 스크롤)">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">프로그램 · 일정</th>
                  <th className="px-3 py-2 text-right font-medium">참가비</th>
                  <th className="px-3 py-2 text-right font-medium">수수료</th>
                  <th className="px-3 py-2 text-right font-medium">받을 금액</th>
                  <th className="px-3 py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} data-testid="settlement-row" className={r.status === "cancelled" ? "text-muted-foreground line-through" : ""}>
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{r.meetup_title}</span>
                      <span className="block text-xs text-muted-foreground">{formatShortDateTime(r.starts_at)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatPrice(r.gross_amount)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatPrice(r.commission_amount)}
                      <span className="block text-[11px] text-muted-foreground">{percentLabel(r.commission_rate_bp)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatPrice(r.net_amount)}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {STATUS_LABEL[r.status]}
                      <span className="block text-muted-foreground">
                        {r.status === "pending" ? `${formatYmd(r.eligible_at)}부터 확정` : r.paid_at ? formatYmd(r.paid_at) : r.confirmed_at ? formatYmd(r.confirmed_at) : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
