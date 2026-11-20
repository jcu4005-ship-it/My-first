import Link from "next/link";

import { SeatCircle } from "@/components/brand/seat-circle";
import { SaveButton } from "@/components/saved";
import { formatPrice, ticketDate } from "@/lib/format";
import { creatorPhoto } from "@/lib/hosting/avatar";
import type { MeetupCardData, Session } from "@/lib/meetups/queries";
import { cn } from "@/lib/utils";

import { SampleBadge, seatsLeft } from "./badges";

/** "몇 명이 먼저 앉았는지" 한 줄 — 실제 예약 수만 */
export function seatLine(s: Session) {
  const left = seatsLeft(s);
  if (s.status !== "open" || left === 0) return { text: "원이 가득 찼어요 · 마감", closed: true };
  if (s.reserved_count === 0) return { text: `첫 번째 자리예요 · ${left}자리 남음`, closed: false };
  return { text: `${s.reserved_count}명이 먼저 앉았어요 · ${left}자리 남음`, closed: false };
}

/**
 * 원 카드 (드롭 × 모닥불 원): 왼쪽 제목·크리에이터·일정·참가비·먼저 앉은 사람, 오른쪽 작은 원(가운데 크리에이터 얼굴).
 * 원은 꾸밈(글자로 같은 내용을 알려 줌). 저장 버튼은 링크 밖에.
 */
export function CircleCard({ meetup, categoryName }: { meetup: MeetupCardData; categoryName: string }) {
  const s = meetup.nextSession;
  const d = ticketDate(s.starts_at);
  const line = seatLine(s);
  const face = (meetup.host && creatorPhoto(meetup.host)) || meetup.cover_image_url;
  const more = meetup.upcomingSessions.length - 1;
  const meta = `${d.md} ${d.time} · ${s.area}`;
  return (
    <div className="relative h-full">
      <Link
        href={`/meetups/${meetup.id}`}
        className="group grid h-full grid-cols-[1fr_92px] items-center gap-3 rounded-[22px] border border-border bg-card p-4 transition-colors hover:border-amber/50 sm:grid-cols-[1fr_108px] sm:p-5"
        data-testid="meetup-card"
      >
        <div className="min-w-0 self-stretch pb-9">
          {meetup.is_sample && <SampleBadge className="mb-1.5" />}
          <h3 className="line-clamp-2 text-[16px] leading-snug font-extrabold tracking-[-0.03em] break-keep group-hover:underline group-hover:underline-offset-4 sm:text-[17px]">
            {meetup.title}
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {meetup.host?.display_name} · {d.md} ({d.wd}) {d.time} · {s.area}
            {more > 0 && ` · 외 ${more}회`}
            <span className="sr-only"> · {categoryName}</span>
          </p>
          <p className="mt-2 text-[13px]">
            <b className="font-num font-semibold">{formatPrice(meetup.price)}</b>
          </p>
          <p className={cn("mt-1 text-[13px] font-bold", line.closed ? "text-muted-foreground" : "text-amber")} data-testid="card-seats">
            {line.text}
            <span className="sr-only"> · 정원 {s.capacity}명</span>
          </p>
        </div>
        <SeatCircle
          decorative
          capacity={s.capacity}
          taken={s.reserved_count}
          you={line.closed ? false : "open"}
          face={face}
          initial={meetup.host?.display_name.slice(0, 1) ?? meetup.title.slice(0, 1)}
        />
      </Link>
      <SaveButton item={{ id: meetup.id, title: meetup.title, meta }} tone="dark" className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5" />
    </div>
  );
}

export function CircleGrid({ meetups, categoryNames }: { meetups: MeetupCardData[]; categoryNames: Record<string, string> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3" data-testid="meetup-grid">
      {meetups.map((m) => (
        <CircleCard key={m.id} meetup={m} categoryName={categoryNames[m.category_slug] ?? m.category_slug} />
      ))}
    </div>
  );
}
