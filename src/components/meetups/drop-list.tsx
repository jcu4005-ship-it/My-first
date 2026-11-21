import Link from "next/link";
import { BadgeCheck } from "lucide-react";

import { creatorPhoto } from "@/lib/hosting/avatar";
import { secondsUntil } from "@/lib/format";
import { kstTime, opensLabel } from "@/lib/meetups/drops";
import type { MeetupCardData, Session } from "@/lib/meetups/queries";

import { hostVerified } from "./circle-card";
import { OpenAlertButton } from "./open-alert-button";
import { OpensCountdown } from "./opens-countdown";
import { Photo } from "@/components/media/photo";

export type DropItem = { meetup: MeetupCardData; session: Session };

/**
 * 곧 열리는 원 목록 — 열림 시각 · 프로그램 · 크리에이터 · 정원 · 알림 버튼.
 * withCountdown: 가장 가까운 한 줄에 카운트다운. 숫자는 실제 열림 시각·정원만.
 */
export function DropList({
  items,
  alertOn,
  loggedIn,
  followedIds,
  withCountdown = true,
}: {
  items: DropItem[];
  alertOn: Set<string>;
  loggedIn: boolean;
  followedIds?: Set<string>;
  withCountdown?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-3" data-testid="drop-list">
      {items.map(({ meetup, session }, i) => {
        const host = meetup.host;
        const photo = host ? creatorPhoto(host) : null;
        const followed = Boolean(host && followedIds?.has(host.user_id));
        return (
          <li key={session.id} className="rounded-[20px] border border-border bg-card p-4 sm:p-5" data-testid="drop-item">
            <div className="flex items-start gap-3.5">
              <span className="font-num w-[4.25rem] shrink-0 pt-0.5 text-[22px] leading-none font-semibold text-forest">{kstTime(session.opens_at as string)}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/meetups/${meetup.id}`} className="block text-[17px] leading-snug font-bold tracking-[-0.02em] break-keep hover:underline hover:underline-offset-4">
                  {meetup.title}
                </Link>
                <p className="mt-1.5 flex min-w-0 items-center gap-2 text-[14.5px] text-muted-foreground">
                  <span className="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[12px] font-bold text-forest">
                    {photo ? <Photo src={photo} alt="" sizes="24px" fallback={null} className="object-[50%_18%]" /> : <span aria-hidden>{host?.display_name.slice(0, 1)}</span>}
                  </span>
                  <span className="truncate">{host?.display_name}</span>
                  {hostVerified(host) && <BadgeCheck aria-label="운영팀 심사를 통과한 크리에이터" className="size-4 shrink-0 text-forest" strokeWidth={2} />}
                  {followed && <span className="shrink-0 rounded-full border border-gold/60 px-2 py-0.5 text-[13.5px] font-semibold text-forest">팔로우 중</span>}
                </p>
                <p className="mt-1 text-[14.5px] text-muted-foreground">
                  프로그램 {opensLabel(session.starts_at)} · {session.area} · 정원 {session.capacity}명
                </p>
              </div>
            </div>
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5">
              {withCountdown && i === 0 ? (
                <OpensCountdown opensAt={session.opens_at as string} initialSeconds={secondsUntil(session.opens_at as string)} />
              ) : (
                <span className="text-[14.5px] text-muted-foreground">{opensLabel(session.opens_at as string)}에 열려요</span>
              )}
              {!meetup.is_sample && <OpenAlertButton meetupId={meetup.id} sessionId={session.id} on={alertOn.has(session.id)} loggedIn={loggedIn} size="sm" className={loggedIn ? undefined : "inline-flex h-10 items-center rounded-xl border border-border px-4 text-[14.5px] font-semibold hover:border-foreground/50"} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** 아직 열리지 않은 모든 회차를 열림 시각 순으로 (샘플 제외) */
export function collectDrops(meetups: MeetupCardData[], isNotOpen: (s: Session) => boolean, opts: { withinDays?: number; limit?: number } = {}): DropItem[] {
  const out: DropItem[] = [];
  for (const meetup of meetups) {
    if (meetup.is_sample) continue;
    for (const session of meetup.upcomingSessions) {
      if (session.status === "open" && isNotOpen(session)) out.push({ meetup, session });
    }
  }
  out.sort((a, b) => (a.session.opens_at as string).localeCompare(b.session.opens_at as string));
  return opts.limit ? out.slice(0, opts.limit) : out;
}
