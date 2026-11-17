import Link from "next/link";

import { Photo } from "@/components/media/photo";
import { PILLARS } from "@/config/pillars";
import { formatPrice, ticketDate } from "@/lib/format";
import type { MeetupCardData } from "@/lib/meetups/queries";
import { cn } from "@/lib/utils";

import { SaveButton } from "@/components/saved";

import { SampleBadge, seatsLeft } from "./badges";

/**
 * 프로그램 카드 (2026-11-17 시안): 위 사진(없으면 어두운 면 + 분야 이름) · 오른쪽 위 저장 · 아래 분야·제목·날짜와 장소·남은 자리·참가비.
 * 남은 자리는 글자로만 (다른 참가자의 얼굴은 보여 주지 않음). 의자·테이블 그림은 상세 화면에서만.
 */
export function MeetupCard({
  meetup,
  categoryName,
  pillar,
}: {
  meetup: MeetupCardData;
  categoryName: string;
  pillar?: string;
}) {
  const s = meetup.nextSession;
  const d = ticketDate(s.starts_at);
  const left = seatsLeft(s);
  const closed = s.status !== "open" || left === 0;
  const more = meetup.upcomingSessions.length - 1;
  const pillarLabel = PILLARS.find(
    (p) => p.slug === pillar,
  )?.label.toUpperCase();
  const meta = `${d.md} ${d.time} · ${s.area}`;
  return (
    <div className="relative h-full">
      <Link
        href={`/meetups/${meetup.id}`}
        className="group relative flex h-full flex-col overflow-hidden rounded-[18px] bg-card shadow-[0_1px_0_rgb(31_33_30/0.04),0_16px_30px_-22px_rgb(31_33_30/0.55)] transition-transform hover:-translate-y-0.5"
        data-testid="meetup-card"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(150deg,#3a332c_0%,#26221d_100%)]">
          {meetup.cover_image_url ? (
            <Photo
              src={meetup.cover_image_url}
              alt={meetup.title}
              fallback={null}
              className="transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div aria-hidden className="absolute inset-0 flex items-end p-3.5">
              <span className="font-display text-lg leading-tight font-bold text-[#efe8dc]/90">
                {categoryName}
              </span>
            </div>
          )}
          {meetup.is_sample && (
            <SampleBadge className="absolute top-2.5 left-2.5" />
          )}
        </div>
        <div className="flex flex-1 flex-col px-3.5 pt-3 pb-3.5">
          {pillarLabel && (
            <p className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground">
              {pillarLabel}
            </p>
          )}
          <h3 className="mt-1 line-clamp-2 text-[14.5px] leading-snug font-bold break-keep group-hover:underline group-hover:underline-offset-4">
            {meetup.title}
          </h3>
          <p className="mt-1.5 truncate text-[12px] text-muted-foreground">
            {d.md} ({d.wd}) {d.time} · {s.area}
            <span className="sr-only"> · {categoryName}</span>
          </p>
          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <p
              className={cn(
                "text-[12px] font-semibold",
                closed
                  ? "text-muted-foreground"
                  : left <= 2
                    ? "text-clay"
                    : "text-forest",
              )}
              data-testid="card-seats"
            >
              {closed ? "마감" : `${left}자리 남음`}
              <span className="font-normal text-muted-foreground">
                {" "}
                · 정원 {s.capacity}명
              </span>
              <span className="block truncate font-normal text-muted-foreground">
                {meetup.host?.display_name}
                {more > 0 && ` · 외 ${more}회`}
              </span>
            </p>
            <b className="shrink-0 text-[14px]">{formatPrice(meetup.price)}</b>
          </div>
        </div>
      </Link>
      {/* 저장 버튼은 링크 밖에 (링크 안의 버튼은 화면 읽기 도구에서 혼란) */}
      <SaveButton
        item={{ id: meetup.id, title: meetup.title, meta }}
        className="absolute top-2 right-2"
      />
    </div>
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
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
      data-testid="meetup-grid"
    >
      {meetups.map((m) => (
        <MeetupCard
          key={m.id}
          meetup={m}
          categoryName={categoryNames[m.category_slug] ?? m.category_slug}
          pillar={pillarOf?.[m.category_slug]}
        />
      ))}
    </div>
  );
}
