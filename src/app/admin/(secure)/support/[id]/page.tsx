import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/forms/action-form";
import { StatusPill } from "@/components/forms/controls";
import { SupportThread } from "@/components/support/thread";
import { requireAdmin } from "@/lib/auth/guards";
import { formatShortDateTime } from "@/lib/format";
import { getTicket } from "@/lib/support/queries";
import { SUPPORT_CATEGORY_LABEL, SUPPORT_STATUS_LABEL, SUPPORT_STATUS_TONE } from "@/lib/support/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { setSupportStatusAction } from "../../actions";

import { AdminReplyForm } from "./admin-reply-form";

export const metadata: Metadata = { title: "문의 답변" };
export const instant = false;

export default async function AdminSupportTicketPage({ params }: PageProps<"/admin/support/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/support/${id}`);
  const data = await getTicket(id);
  if (!data) notFound();
  const { ticket, messages, booking } = data;
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from("profiles").select("nickname").eq("id", ticket.user_id).maybeSingle();
  return (
    <div className="flex max-w-2xl flex-col gap-6" data-testid="admin-ticket">
      <Link href="/admin/support" className="text-sm text-muted-foreground hover:text-foreground">← 문의함</Link>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={SUPPORT_STATUS_TONE[ticket.status]}>{SUPPORT_STATUS_LABEL[ticket.status]}</StatusPill>
          <span className="text-xs text-muted-foreground">{SUPPORT_CATEGORY_LABEL[ticket.category]} · {profile?.nickname ?? "(알 수 없음)"} · {formatShortDateTime(ticket.created_at)}</span>
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold">{ticket.subject}</h1>
        {booking && <p className="mt-2 text-sm text-muted-foreground">관련 신청 · {formatShortDateTime(booking.starts_at)} {booking.title} ({booking.status})</p>}
      </div>
      <SupportThread messages={messages} viewer="staff" />
      <div className="rounded-2xl border bg-card p-5">
        <AdminReplyForm ticketId={ticket.id} />
      </div>
      <div className="flex flex-wrap gap-2">
        {ticket.status !== "closed" && <ActionForm action={setSupportStatusAction} hidden={{ ticketId: ticket.id, status: "closed" }} label="해결됨으로 처리" testId="ticket-close" />}
        {ticket.status === "closed" && <ActionForm action={setSupportStatusAction} hidden={{ ticketId: ticket.id, status: "open" }} label="다시 열기" testId="ticket-reopen" />}
      </div>
    </div>
  );
}
