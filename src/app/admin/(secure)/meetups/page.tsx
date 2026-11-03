import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { requireAdmin } from "@/lib/auth/guards";
import { formatPrice, formatShortDateTime } from "@/lib/format";
import { MEETUP_STATUS_LABEL, listMeetupsByStatus, type MeetupStatus } from "@/lib/hosting/queries";
import { cn } from "@/lib/utils";

import { reviewMeetupAction } from "../actions";

export const metadata: Metadata = { title: "클래스 심사·운영" };
export const instant = false;

const TABS: MeetupStatus[] = ["pending_review", "published", "suspended", "rejected"];

export default async function AdminMeetupsPage({ searchParams }: PageProps<"/admin/meetups">) {
  await requireAdmin("/admin/meetups");
  const { status } = (await searchParams) as { status?: string };
  const current = (TABS.includes(status as MeetupStatus) ? status : "pending_review") as MeetupStatus;
  const meetups = await listMeetupsByStatus(current);

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-bold">클래스 심사·운영</h1>
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="상태">
        {TABS.map((t) => (
          <Link key={t} href={`/admin/meetups?status=${t}`}
            className={cn("rounded-full border px-4 py-1.5 text-sm", t === current ? "border-foreground bg-foreground text-background" : "")}>
            {MEETUP_STATUS_LABEL[t]}
          </Link>
        ))}
      </nav>
      {meetups.length === 0 && <p className="text-sm text-muted-foreground">해당 상태의 클래스가 없어요.</p>}
      <ul className="flex flex-col gap-4">
        {meetups.map((m) => (
          <li key={m.id} className="rounded-2xl border p-5" data-testid="review-meetup" data-title={m.title}>
            <p className="text-xs text-muted-foreground">{m.host?.display_name}{m.is_sample ? " · 샘플" : ""} · {m.category_slug} · {formatPrice(m.price)}{m.meetup_type === "alcohol" ? " · 주류" : ""}</p>
            <p className="mt-1 font-semibold">{m.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{m.summary}</p>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">소개·일정 보기</summary>
              <p className="mt-2 leading-relaxed whitespace-pre-line">{m.description}</p>
              <ul className="mt-3 flex flex-col gap-1">
                {m.sessions.map((s) => (
                  <li key={s.id}>{formatShortDateTime(s.starts_at)} · {s.area} {s.venue_name} · 정원 {s.capacity} (신청 {s.reserved_count}) · {s.status}</li>
                ))}
              </ul>
            </details>
            {m.review_note && <p className="mt-2 text-xs text-muted-foreground">메모: {m.review_note}</p>}
            <div className="mt-4 flex flex-wrap items-start gap-4 border-t pt-4">
              {current === "pending_review" && (
                <>
                  <ActionForm action={reviewMeetupAction} hidden={{ meetupId: m.id, action: "publish", note: "" }} label="승인·공개" variant="default" testId="publish-meetup" />
                  <ActionForm action={reviewMeetupAction} hidden={{ meetupId: m.id, action: "reject" }} label="반려"
                    note={{ name: "note", placeholder: "반려 사유 (5자 이상, 호스트에게 보여요)" }} />
                </>
              )}
              {current === "published" && (
                <>
                  <Link href={`/meetups/${m.id}`} className="text-sm underline underline-offset-4">공개 페이지</Link>
                  <ActionForm action={reviewMeetupAction} hidden={{ meetupId: m.id, action: "suspend" }} label="운영 정지"
                    note={{ name: "note", placeholder: "정지 사유 (5자 이상)" }} />
                </>
              )}
              {current === "suspended" && (
                <ActionForm action={reviewMeetupAction} hidden={{ meetupId: m.id, action: "unsuspend", note: "" }} label="다시 공개" />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
