import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusPill } from "@/components/forms/controls";
import { SiteHeader } from "@/components/site-header";
import { SupportThread } from "@/components/support/thread";
import { requireMember } from "@/lib/auth/guards";
import { formatShortDateTime } from "@/lib/format";
import { getTicket } from "@/lib/support/queries";
import { SUPPORT_CATEGORY_LABEL, SUPPORT_STATUS_LABEL, SUPPORT_STATUS_TONE } from "@/lib/support/types";

import { ReplyForm } from "./reply-form";

export const metadata: Metadata = { title: "문의 내용" };
export const instant = false;

export default async function MySupportTicketPage({ params, searchParams }: PageProps<"/me/support/[id]">) {
  const { id } = await params;
  const member = await requireMember(`/me/support/${id}`);
  const { sent } = (await searchParams) as { sent?: string };
  const data = await getTicket(id);
  if (!data || data.ticket.user_id !== member.id) notFound();
  const { ticket, messages, booking } = data;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:px-6" data-testid="support-ticket">
        <Link href="/me/support" className="text-sm text-muted-foreground hover:text-foreground">← 내 문의</Link>
        {sent && (
          <p className="mt-4 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="ticket-sent">
            문의를 보냈어요. 운영팀이 확인한 뒤 답변하고, 답변이 오면 알림으로 알려 드려요.
          </p>
        )}
        <div className="mt-4 flex items-center gap-2">
          <StatusPill tone={SUPPORT_STATUS_TONE[ticket.status]}>{SUPPORT_STATUS_LABEL[ticket.status]}</StatusPill>
          <span className="text-xs text-muted-foreground">{SUPPORT_CATEGORY_LABEL[ticket.category]} · {formatShortDateTime(ticket.created_at)}</span>
        </div>
        <h1 className="mt-2 font-display text-xl font-bold sm:text-2xl" data-testid="ticket-subject">{ticket.subject}</h1>
        {booking && (
          <p className="mt-2 rounded-xl bg-card px-3 py-2 text-xs text-muted-foreground">관련 신청 · {formatShortDateTime(booking.starts_at)} {booking.title}</p>
        )}
        <div className="mt-6">
          <SupportThread messages={messages} viewer="member" />
        </div>
        <div className="mt-8 rounded-[20px] bg-card p-5 shadow-[0_2px_0_rgb(35_51_42/0.08),0_14px_24px_-14px_rgb(35_51_42/0.4)]">
          <ReplyForm ticketId={ticket.id} />
        </div>
      </main>
    </>
  );
}
