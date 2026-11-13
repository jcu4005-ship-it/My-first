import type { Metadata } from "next";
import Link from "next/link";

import { StatusPill } from "@/components/forms/controls";
import { requireAdmin } from "@/lib/auth/guards";
import { formatShortDateTime } from "@/lib/format";
import { listTicketsForAdmin } from "@/lib/support/queries";
import { SUPPORT_CATEGORY_LABEL, SUPPORT_STATUS_LABEL, SUPPORT_STATUS_TONE, type SupportStatus } from "@/lib/support/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "문의함" };
export const instant = false;

const TABS: { value?: SupportStatus; label: string }[] = [
  { value: "open", label: "답변 대기" },
  { value: "answered", label: "답변 완료" },
  { value: "closed", label: "해결됨" },
  { label: "전체" },
];

export default async function AdminSupportPage({ searchParams }: PageProps<"/admin/support">) {
  await requireAdmin("/admin/support");
  const sp = (await searchParams) as { status?: string };
  const status = (["open", "answered", "closed", "all"].includes(sp.status ?? "") ? sp.status : "open") as SupportStatus | "all";
  const tickets = await listTicketsForAdmin(status === "all" ? undefined : status);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold">문의함</h1>
        <p className="mt-2 text-sm text-muted-foreground">회원 1:1 문의예요. 답변하면 회원에게 알림이 가고 감사 기록이 남아요. 회원 이메일·연락처는 여기서 보이지 않아요.</p>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="상태">
        {TABS.map((t) => {
          const v = t.value ?? "all";
          return (
            <Link key={v} href={`/admin/support?status=${v}`} aria-current={status === v ? "page" : undefined}
              className={cn("rounded-full border px-4 py-1.5 text-sm", status === v ? "border-forest bg-forest text-white" : "bg-card hover:border-forest/40")}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      {tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="empty-state">이 상태의 문의가 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/support/${t.id}`} className="flex flex-col gap-1 rounded-2xl border bg-card p-4 hover:border-forest/40 sm:flex-row sm:items-center sm:justify-between" data-testid="admin-ticket-row" data-subject={t.subject}>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <StatusPill tone={SUPPORT_STATUS_TONE[t.status]}>{SUPPORT_STATUS_LABEL[t.status]}</StatusPill>
                    <span className="text-xs text-muted-foreground">{SUPPORT_CATEGORY_LABEL[t.category]}</span>
                    {t.category === "safety" && <span className="text-xs font-bold text-clay">우선 확인</span>}
                  </span>
                  <span className="mt-1 block truncate font-semibold">{t.subject}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{t.nickname} · {formatShortDateTime(t.last_message_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
