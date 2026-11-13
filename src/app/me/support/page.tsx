import type { Metadata } from "next";
import Link from "next/link";

import { StatusPill } from "@/components/forms/controls";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { requireMember } from "@/lib/auth/guards";
import { formatShortDateTime } from "@/lib/format";
import { listMyTickets } from "@/lib/support/queries";
import { SUPPORT_CATEGORY_LABEL, SUPPORT_STATUS_LABEL, SUPPORT_STATUS_TONE } from "@/lib/support/types";

export const metadata: Metadata = { title: "내 문의" };
export const instant = false;

export default async function MySupportPage() {
  const member = await requireMember("/me/support");
  const tickets = await listMyTickets(member.id);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex items-end justify-between gap-3">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">내 문의</h1>
          <Button asChild size="sm"><Link href="/help/contact">새 문의</Link></Button>
        </div>
        {tickets.length === 0 ? (
          <div className="mt-6 rounded-[18px] border-[1.5px] border-dashed border-[#cfc6b5] bg-card/60 px-5 py-8 text-center text-sm text-muted-foreground" data-testid="empty-state">
            아직 남긴 문의가 없어요.
            <Link href="/help" className="mt-2 block font-semibold text-forest underline-offset-4 hover:underline">자주 묻는 질문 보기</Link>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-2.5">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/me/support/${t.id}`} className="block rounded-2xl bg-card p-4 shadow-[0_2px_0_rgb(35_51_42/0.08),0_14px_24px_-14px_rgb(35_51_42/0.4)] hover:-translate-y-0.5 transition-transform" data-testid="ticket-row" data-status={t.status}>
                  <span className="flex items-center gap-2">
                    <StatusPill tone={SUPPORT_STATUS_TONE[t.status]}>{SUPPORT_STATUS_LABEL[t.status]}</StatusPill>
                    <span className="text-xs text-muted-foreground">{SUPPORT_CATEGORY_LABEL[t.category]}</span>
                  </span>
                  <span className="mt-2 block truncate font-semibold">{t.subject}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{formatShortDateTime(t.last_message_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
