import Link from "next/link";

import { Photo } from "@/components/media/photo";
import { PILLARS } from "@/config/pillars";
import { formatPrice, ticketDate } from "@/lib/format";
import type { MeetupCardData } from "@/lib/meetups/queries";
import { cn } from "@/lib/utils";

import { SampleBadge, seatsLeft } from "./badges";

/**
 * 프로그램 카드 — 반복되는 동그라미 그림 없이 글자 중심(눈의 피로를 줄임).
 * 위: 대표 사진(없으면 분야 이름만 있는 세이지 면) / 아래: 날짜·동네, 제목, 남은 자리(글자), 호스트·참가비
 * 의자·테이블 그림은 상세 화면에서만 보여 준다.
 */
export function MeetupCard({ meetup, categoryName, pillar }: { meetup: MeetupCardData; categoryName: string; pillar?: string }) {
  const s = meetup.nextSession;
  const d = ticketDate(s.starts_at);
  const left = seatsLeft(s);
  const closed = s.status !== "open" || left === 0;
  const more = meetup.upcomingSessions.length - 1;
  const pillarLabel = PILLARS.find((p) => p.slug === pillar)?.label.toUpperCase();
  return (
    <Link
      href={`/meetups/${meetup.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-[20px] bg-card shadow-[0_12px_24px_-18px_rgb(35_51_42/0.55)] transition-transform hover:-translate-y-0.5"
      data-testid="meetup-card"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(150deg,#e3e9da_0%,#c4cfb5_70%,#b2bfa2_100%)]">
        {meetup.cover_image_url ? (
          <Photo src={meetup.cover_image_url} alt={meetup.title} fallback={null} />
        ) : (
          <div aria-hidden className="absolute inset-0 flex flex-col justify-end p-3">
            {pillarLabel && <span className="text-[9.5px] tracking-[0.24em] text-[#44513f]">{pillarLabel}</span>}
            <span className="font-display text-lg leading-tight font-bold text-[#2f3f34]">{categoryName}</span>
          </div>
        )}
        {meetup.is_sample && <SampleBadge className="absolute top-2 right-2" />}
      </div>
      <div className="flex flex-1 flex-col px-3 pt-2.5 pb-3">
        <p className="truncate text-[11px] tracking-[0.04em] text-muted-foreground">
          {d.md} {d.wdEn} {d.time} · {s.area}
          <span className="sr-only"> · {categoryName}</span>
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm leading-snug font-bold break-keep group-hover:underline group-hover:underline-offset-4">
          {meetup.title}
        </h3>
        <p
          className={cn("mt-2 text-xs font-semibold", closed ? "text-muted-foreground" : left <= 2 ? "text-clay" : "text-forest")}
          data-testid="card-seats"
        >
          {closed ? "마감" : `${left}자리 남음`}
          <span className="font-normal text-muted-foreground"> · 정원 {s.capacity}명</span>
        </p>
        <p className="mt-auto flex items-baseline justify-between gap-2 border-t border-border/70 pt-2 text-xs">
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
  pillarOf,
}: {
  meetups: MeetupCardData[];
  categoryNames: Record<string, string>;
  pillarOf?: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" data-testid="meetup-grid">
      {meetups.map((m) => (
        <MeetupCard key={m.id} meetup={m} categoryName={categoryNames[m.category_slug] ?? m.category_slug} pillar={pillarOf?.[m.category_slug]} />
      ))}
    </div>
  );
}
