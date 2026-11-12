import Link from "next/link";

import { Seal, SeatTable } from "@/components/brand/seat-table";
import { formatPrice, ticketDate } from "@/lib/format";
import type { MeetupCardData } from "@/lib/meetups/queries";

import { SampleBadge, seatsLeft } from "./badges";

/**
 * 프로그램 카드 = 초대장 티켓
 * 위: 날짜 + 테이블(빈자리) / 절취선 / 아래: 분야·동네, 제목, 호스트 서명, 참가비
 */
export function MeetupCard({ meetup, categoryName }: { meetup: MeetupCardData; categoryName: string }) {
  const s = meetup.nextSession;
  const d = ticketDate(s.starts_at);
  const left = seatsLeft(s);
  const closed = s.status !== "open" || left === 0;
  const more = meetup.upcomingSessions.length - 1;
  return (
    <Link
      href={`/meetups/${meetup.id}`}
      className="ticket group flex h-full flex-col transition-transform hover:-translate-y-0.5"
      data-testid="meetup-card"
    >
      {!closed && left === 1 && <Seal className="absolute -top-2 -right-1.5 z-10 size-10 text-[9.5px]">마지막<br />1석</Seal>}
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <span className="font-display text-[15px] font-bold">
          {d.md}
          <span className="ml-1 font-sans text-[10.5px] font-semibold text-muted-foreground">
            {d.wd} {d.time}
          </span>
        </span>
        {meetup.is_sample && <SampleBadge />}
      </div>
      <SeatTable capacity={s.capacity} taken={s.reserved_count} closed={closed} size="sm" className="mx-4 mt-1 mb-3" />
      <div className="perf" />
      <div className="flex flex-1 flex-col p-3">
        <span className="truncate text-[11px] font-semibold text-clay">
          {categoryName} · {s.area}
        </span>
        <h3 className="mt-0.5 line-clamp-2 text-sm leading-snug font-bold break-keep group-hover:underline group-hover:underline-offset-4">
          {meetup.title}
        </h3>
        {meetup.host && <p className="sign mt-1 truncate text-xs">— {meetup.host.display_name} 드림</p>}
        <p className="mt-auto flex items-baseline justify-between gap-2 pt-2 text-[13.5px] font-extrabold">
          {formatPrice(meetup.price)}
          {more > 0 && <span className="text-[10.5px] font-medium text-muted-foreground">외 {more}회</span>}
        </p>
      </div>
    </Link>
  );
}

export function MeetupGrid({
  meetups,
  categoryNames,
}: {
  meetups: MeetupCardData[];
  categoryNames: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" data-testid="meetup-grid">
      {meetups.map((m) => (
        <MeetupCard key={m.id} meetup={m} categoryName={categoryNames[m.category_slug] ?? m.category_slug} />
      ))}
    </div>
  );
}
