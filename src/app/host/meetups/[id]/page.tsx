import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/forms/action-form";
import { StatusPill } from "@/components/forms/controls";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/guards";
import { formatDate, formatPrice, formatTime, isFuture } from "@/lib/format";
import { MEETUP_STATUS_LABEL, getHostSessionsAndParticipants, getMyMeetup } from "@/lib/hosting/queries";

import { hostCancelMeetupAction, hostCancelSessionAction, meetupStatusAction, sessionStatusAction } from "../../actions";
import { AddSessionForm, CapacityForm } from "./session-forms";

export const metadata: Metadata = { title: "프로그램 관리" };
export const instant = false;

const SESSION_LABEL = { open: "모집 중", closed: "모집 마감", cancelled: "취소됨", completed: "종료" } as const;

export default async function ManageMeetupPage({ params, searchParams }: PageProps<"/host/meetups/[id]">) {
  const { id } = await params;
  const { saved } = (await searchParams) as { saved?: string };
  const member = await requireRole("host", `/host/meetups/${id}`);
  const meetup = await getMyMeetup(member.id, id);
  if (!meetup) notFound();
  const { sessions, participants } = await getHostSessionsAndParticipants(meetup.id);
  const editable = ["draft", "pending_review", "rejected", "published"].includes(meetup.status);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8">
        <Link href="/host" className="text-sm text-muted-foreground">← 내 프로그램</Link>
        {saved && <p className="mt-4 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="saved-notice">저장했어요.</p>}

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <StatusPill tone={meetup.status === "published" ? "ok" : meetup.status === "pending_review" ? "warn" : meetup.status === "rejected" ? "accent" : "muted"}>
              {MEETUP_STATUS_LABEL[meetup.status]}
            </StatusPill>
            <h1 className="mt-2 font-display text-3xl font-bold" data-testid="manage-title">{meetup.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{formatPrice(meetup.price)} · 1회 최대 {meetup.max_quantity_per_booking}명</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {editable && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/host/meetups/${meetup.id}/edit`}>내용 수정</Link>
              </Button>
            )}
            {meetup.status === "published" && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/meetups/${meetup.id}`}>공개 페이지</Link>
              </Button>
            )}
          </div>
        </div>

        {meetup.status === "rejected" && meetup.review_note && (
          <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">반려 사유: {meetup.review_note}</p>
        )}

        <section className="mt-6 flex flex-wrap gap-3">
          {(meetup.status === "draft" || meetup.status === "rejected") && (
            <ActionForm action={meetupStatusAction} hidden={{ meetupId: meetup.id, action: "submit" }} label="검수 요청하기" variant="default" size="default" testId="submit-review" />
          )}
          {meetup.status === "pending_review" && (
            <>
              <p className="w-full text-sm text-muted-foreground">운영팀이 검토 중이에요. 승인되면 공개됩니다.</p>
              <ActionForm action={meetupStatusAction} hidden={{ meetupId: meetup.id, action: "withdraw" }} label="검수 요청 취소" />
            </>
          )}
          {meetup.status === "published" && (
            <ActionForm action={meetupStatusAction} hidden={{ meetupId: meetup.id, action: "close" }} label="모집 종료하기"
              confirmText="모집을 종료하면 목록에서 내려가요. 계속할까요?" />
          )}
          {["published", "pending_review"].includes(meetup.status) && sessions.some((s) => s.status !== "cancelled" && isFuture(s.starts_at)) && (
            <ActionForm action={hostCancelMeetupAction} hidden={{ meetupId: meetup.id }} label="프로그램 전체 취소" variant="ghost"
              note={{ name: "reason", placeholder: "취소 사유 (신청자에게 전달)" }}
              confirmText="앞으로의 모든 일정을 취소할까요? 신청자에게 알림이 가고 결제는 전액 환불됩니다." testId="cancel-meetup" />
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">일정과 참가자</h2>
          {sessions.length === 0 && <p className="mb-4 text-sm text-muted-foreground">아직 일정이 없어요. 아래에서 첫 일정을 추가해 주세요.</p>}
          <ul className="flex flex-col gap-4">
            {sessions.map((s) => {
              const people = participants.filter((p) => p.session_id === s.id && p.status === "confirmed");
              const future = isFuture(s.starts_at);
              return (
                <li key={s.id} className="rounded-2xl border p-5" data-testid="host-session">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{formatDate(s.starts_at)} {formatTime(s.starts_at)}</p>
                      <p className="text-sm text-muted-foreground">{s.area} · {s.venue_name}{s.address_detail ? ` · ${s.address_detail}` : ""}</p>
                    </div>
                    <div className="text-right">
                      <StatusPill tone={s.status === "open" ? "ok" : "muted"}>{SESSION_LABEL[s.status]}</StatusPill>
                      <p className="mt-1 text-sm" data-testid="session-seats">신청 {s.reserved_count} / {s.capacity}명</p>
                    </div>
                  </div>

                  {people.length > 0 ? (
                    <ul className="mt-4 flex flex-wrap gap-2" data-testid="participant-list">
                      {people.map((p) => (
                        <li key={p.booking_id} className="rounded-full bg-secondary px-3 py-1 text-sm">
                          {p.nickname}{p.quantity > 1 ? ` 외 ${p.quantity - 1}명` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">아직 신청자가 없어요.</p>
                  )}

                  {editable && future && s.status !== "cancelled" && (
                    <div className="mt-4 flex flex-wrap items-start gap-3 border-t pt-4">
                      <CapacityForm meetupId={meetup.id} sessionId={s.id} capacity={s.capacity} />
                      {s.status === "open" && <ActionForm action={sessionStatusAction} hidden={{ meetupId: meetup.id, sessionId: s.id, action: "close" }} label="모집 마감" variant="ghost" />}
                      {s.status === "closed" && <ActionForm action={sessionStatusAction} hidden={{ meetupId: meetup.id, sessionId: s.id, action: "open" }} label="모집 재개" variant="ghost" />}
                      <ActionForm action={hostCancelSessionAction} hidden={{ meetupId: meetup.id, sessionId: s.id }} label="일정 취소" variant="ghost"
                        note={{ name: "reason", placeholder: "취소 사유 (신청자에게 전달)" }}
                        confirmText="이 일정을 취소할까요? 신청자에게 알림이 가고 결제는 전액 환불됩니다." testId="cancel-session" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {editable && <div className="mt-6"><AddSessionForm meetupId={meetup.id} /></div>}
        </section>
      </main>
    </>
  );
}
