import Link from "next/link";

import { Seal, SeatTable } from "@/components/brand/seat-table";
import { formatPrice, ticketDate } from "@/lib/format";
import type { MeetupCardData } from "@/lib/meetups/queries";

import { SampleBadge, seatsLeft } from "./badges";

/**
 * 프로그램 카드: 빛이 드는 세이지 바닥 위 의자 원(남은 자리) → 날짜·동네 → 제목 → 호스트 · 참가비
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
      className="group relative flex h-full flex-col rounded-[20px] bg-card p-2.5 shadow-[0_12px_24px_-18px_rgb(35_51_42/0.55)] transition-transform hover:-translate-y-0.5 sm:p-3"
      data-testid="meetup-card"
    >
      {!closed && left === 1 && <Seal className="absolute -top-2 -right-1.5 z-10 size-10 text-[9.5px]">마지막<br />1석</Seal>}
      <div className="relative rounded-[14px] bg-[radial-gradient(90%_70%_at_15%_10%,#e6ecdd_0%,#c4cfb5_60%,#a9b898_100%)] p-[6%]">
        <SeatTable capacity={s.capacity} taken={s.reserved_count} closed={closed} size="sm" />
        {meetup.is_sample && <SampleBadge className="absolute top-2 right-2" />}
      </div>
      <div className="flex flex-1 flex-col px-1 pt-2.5 pb-0.5">
        <p className="truncate text-[11px] tracking-[0.04em] text-muted-foreground">
          {d.md} {d.wdEn} · {s.area}
          <span className="sr-only"> · {categoryName}</span>
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm leading-snug font-bold break-keep group-hover:underline group-hover:underline-offset-4">
          {meetup.title}
        </h3>
        <p className="mt-auto flex items-baseline justify-between gap-2 pt-2 text-xs">
          <span className="truncate text-muted-foreground">
            {meetup.host?.display_name}
            {more > 0 && ` · 외 ${more}회`}
          </span>
          <b className="shrink-0 text-[13px]">{formatPrice(meetup.price)}</b>
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
