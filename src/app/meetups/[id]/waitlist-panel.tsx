import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { formatDate, formatTime } from "@/lib/format";

import { waitlistAction } from "./actions";

/**
 * 마감된 일정의 대기 신청. 자리가 나면(취소·정원 늘림) 대기자 모두에게 알림이 가고,
 * 먼저 신청한 분이 자리를 가져가요(자동 배정 없음).
 */
export function WaitlistPanel({
  meetupId,
  sessions,
  waiting,
  loggedIn,
}: {
  meetupId: string;
  sessions: { id: string; starts_at: string }[];
  waiting: Set<string>;
  loggedIn: boolean;
}) {
  if (!sessions.length) return null;
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-4" data-testid="waitlist">
      <p className="text-sm font-semibold">마감된 일정 대기하기</p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">자리가 나면 알림으로 알려 드려요. 먼저 신청한 분이 자리를 가져가요.</p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm" data-testid="waitlist-row">
            <span>
              {formatDate(s.starts_at)} {formatTime(s.starts_at)}
              {waiting.has(s.id) && <span className="ml-2 text-[13px] font-semibold text-forest" data-testid="waitlist-on">대기 중</span>}
            </span>
            {!loggedIn ? (
              <Link href={`/login?next=/meetups/${meetupId}`} className="text-sm font-semibold text-forest underline-offset-4 hover:underline">
                로그인하고 대기하기
              </Link>
            ) : waiting.has(s.id) ? (
              <ActionForm action={waitlistAction} hidden={{ meetupId, sessionId: s.id, op: "leave" }} label="대기 취소" variant="ghost" testId="waitlist-leave" />
            ) : (
              <ActionForm action={waitlistAction} hidden={{ meetupId, sessionId: s.id, op: "join" }} label="대기 신청" testId="waitlist-join" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
