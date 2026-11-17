import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { requireAdmin } from "@/lib/auth/guards";
import { formatPrice, formatShortDateTime, formatYmd, isFuture } from "@/lib/format";
import { getAppSettings, percentLabel } from "@/lib/settings/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { advanceSettlementAction } from "../actions";
import { CommissionForm } from "./commission-form";

export const metadata: Metadata = { title: "정산 관리" };
export const instant = false;

type Row = {
  id: string;
  host_name: string;
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
  memo: string | null;
  mode: string;
};

const STATUS_LABEL = { pending: "정산 대기", confirmed: "정산 확정", paid: "지급 완료", cancelled: "환불로 취소" } as const;
const FILTERS = ["pending", "confirmed", "paid", "cancelled"] as const;

export default async function AdminSettlementsPage({ searchParams }: PageProps<"/admin/settlements">) {
  await requireAdmin("/admin/settlements");
  const raw = (await searchParams).status;
  const status = typeof raw === "string" && (FILTERS as readonly string[]).includes(raw) ? raw : null;
  const supabase = await createSupabaseServerClient();
  const [{ data }, settings] = await Promise.all([supabase.rpc("admin_settlements", { p_status: status }), getAppSettings()]);
  const rows = (data as Row[] | null) ?? [];
  const total = (k: "gross_amount" | "commission_amount" | "net_amount") => rows.filter((r) => r.status !== "cancelled").reduce((n, r) => n + r[k], 0);

  return (
    <div data-testid="admin-settlements">
      <h1 className="font-display text-3xl font-bold">정산 관리</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        참가비는 모두 플랫폼 결제로만 받고, 호스트에게는 수수료를 뺀 금액을 정산해요. 수수료율은 결제 순간의 비율로 고정돼요.
        이 화면은 확정·지급을 <b>기록</b>만 해요(자동 송금 없음). 지금은 테스트 결제라 실제 지급 대상이 아니에요.
      </p>

      <section className="mt-6 rounded-xl border p-5">
        <h2 className="font-semibold">수수료 설정</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          현재 <b data-testid="current-rate">{percentLabel(settings.commission_rate_bp)}</b> · 호스트 승인 후 <b>{settings.commission_free_months}개월</b>은 0%. 바꾸면 앞으로 결제되는 신청부터 적용돼요.
        </p>
        <CommissionForm ratePercent={settings.commission_rate_bp / 100} freeMonths={settings.commission_free_months} />
      </section>

      <nav className="mt-8 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/settlements" className={`rounded-full border px-3 py-1 ${status ? "" : "border-foreground font-semibold"}`}>전체</Link>
        {FILTERS.map((f) => (
          <Link key={f} href={`/admin/settlements?status=${f}`} className={`rounded-full border px-3 py-1 ${status === f ? "border-foreground font-semibold" : ""}`}>
            {STATUS_LABEL[f]}
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-sm" data-testid="settlement-sum">
        합계 · 참가비 {formatPrice(total("gross_amount"))} · 수수료 {formatPrice(total("commission_amount"))} · 호스트 정산 <b>{formatPrice(total("net_amount"))}</b>
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">정산 내역이 없어요.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((r) => {
            const eligible = !isFuture(r.eligible_at);
            return (
              <li key={r.id} className="rounded-xl border p-4" data-testid="admin-settlement-row">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{r.host_name} · {r.meetup_title}</p>
                    <p className="text-xs text-muted-foreground">{formatShortDateTime(r.starts_at)} · 정산 가능 {formatYmd(r.eligible_at)}</p>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <p>참가비 {formatPrice(r.gross_amount)} − 수수료 {formatPrice(r.commission_amount)} ({percentLabel(r.commission_rate_bp)})</p>
                    <p className="font-bold">정산 {formatPrice(r.net_amount)}</p>
                    <p className="text-xs text-muted-foreground">{STATUS_LABEL[r.status]}{r.mode === "test" ? " · 테스트" : ""}</p>
                  </div>
                </div>
                {r.memo && <p className="mt-2 text-xs text-muted-foreground">메모 · {r.memo}</p>}
                {r.status === "pending" && (
                  eligible ? (
                    <ActionForm action={advanceSettlementAction} hidden={{ id: r.id, action: "confirm" }} label="정산 확정"
                      note={{ name: "memo", placeholder: "메모 (5자 이상, 예: 11월 1차 정산)" }} className="mt-3" testId="settlement-confirm" />
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">프로그램이 끝나고 7일이 지나면 확정할 수 있어요.</p>
                  )
                )}
                {r.status === "confirmed" && (
                  <ActionForm action={advanceSettlementAction} hidden={{ id: r.id, action: "paid" }} label="지급 완료 기록"
                    note={{ name: "memo", placeholder: "메모 (5자 이상, 예: 11/30 이체 완료)" }} className="mt-3" testId="settlement-paid"
                    confirmText="시스템 밖에서 실제로 송금을 마쳤나요? 지급 완료로 기록하면 호스트에게 알림이 가요." />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
