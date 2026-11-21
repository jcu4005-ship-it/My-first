import Link from "next/link";
import { BadgeCheck, CalendarDays, MapPin, Star } from "lucide-react";

import { SeatCircle } from "@/components/brand/seat-circle";
import { Photo } from "@/components/media/photo";
import { SaveButton } from "@/components/saved";
import { formatPrice, ticketDate } from "@/lib/format";
import { creatorPhoto } from "@/lib/hosting/avatar";
import { isNotYetOpen, opensLabel } from "@/lib/meetups/drops";
import type { MeetupCardData, Session } from "@/lib/meetups/queries";
import type { ReviewSummary } from "@/lib/reviews/queries";
import { cn } from "@/lib/utils";

import { SampleBadge, seatsLeft } from "./badges";

/** "몇 명이 먼저 앉았는지" 한 줄 — 실제 예약 수만 */
export function seatLine(s: Session): { text: string; closed: boolean; left: number; notOpen?: boolean } {
  const left = seatsLeft(s);
  // 열림 시각(드롭) 전: 자리 수가 아니라 "언제 열리는지"
  if (s.status === "open" && isNotYetOpen(s)) return { text: `${opensLabel(s.opens_at as string)}에 열려요`, closed: false, left, notOpen: true };
  if (s.status !== "open" || left === 0) return { text: "모집 마감 · 원이 가득 찼어요", closed: true, left: 0 };
  if (s.reserved_count === 0) return { text: `첫 번째 자리예요 · ${left}자리 남음`, closed: false, left };
  return { text: `${s.reserved_count}명 신청 · ${left}자리 남음`, closed: false, left };
}

/** 운영팀 심사를 거쳐 소개까지 마친 크리에이터 (샘플·소개 준비 중은 아님) */
export function hostVerified(h: { headline?: string | null; bio?: string | null; is_sample?: boolean } | null | undefined) {
  return Boolean(h && !h.is_sample && (h.headline || h.bio));
}

/**
 * 프로그램 카드 (색 D안): 크리에이터(얼굴·이름·하는 일·심사) → 프로그램명 → 날짜·장소 → 참가비·남은 자리 → 후기.
 * 오른쪽 작은 원은 꾸밈(같은 내용을 글자로 알려 줌). 후기는 실제 공개 후기가 있을 때만.
 */
export function CircleCard({ meetup, categoryName, trust }: { meetup: MeetupCardData; categoryName: string; trust?: ReviewSummary }) {
  const s = meetup.nextSession;
  const d = ticketDate(s.starts_at);
  const line = seatLine(s);
  const host = meetup.host;
  const face = (host && creatorPhoto(host)) || meetup.cover_image_url;
  const more = meetup.upcomingSessions.length - 1;
  const meta = `${d.md} ${d.time} · ${s.area}`;
  const verified = hostVerified(host);
  return (
    <div className="relative h-full">
      <Link
        href={`/meetups/${meetup.id}`}
        className="group grid h-full grid-cols-[1fr_76px] gap-x-3 rounded-[20px] border border-border bg-card p-4 transition-colors hover:border-navy/40 sm:grid-cols-[1fr_88px] sm:p-5"
        data-testid="meetup-card"
      >
        <div className="min-w-0">
          {/* 크리에이터 */}
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-display text-[14px] font-bold text-forest">
              {host && creatorPhoto(host) ? <Photo src={creatorPhoto(host)} alt="" sizes="36px" fallback={null} className="object-[50%_18%]" /> : <span aria-hidden>{host?.display_name.slice(0, 1)}</span>}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="flex items-center gap-1">
                <b className="truncate text-[15px] font-bold">{host?.display_name}</b>
                {verified && <BadgeCheck aria-label="운영팀 심사를 통과한 크리에이터" className="size-4 shrink-0 text-forest" strokeWidth={2} />}
              </span>
              {host?.occupation && <span className="block truncate text-[14.5px] text-muted-foreground">{host.occupation}</span>}
            </span>
          </div>
          {/* 프로그램 */}
          <h3 className="mt-2.5 line-clamp-2 text-[17px] leading-snug font-bold tracking-[-0.02em] break-keep group-hover:underline group-hover:underline-offset-4 sm:text-[18px]">
            {meetup.title}
          </h3>
          {meetup.is_sample && <SampleBadge className="mt-1.5" />}
          {/* 날짜·장소 */}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden className="size-4" strokeWidth={1.7} />
              {d.md} ({d.wd}) {d.time}
              {more > 0 && ` · 외 ${more}회`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden className="size-4" strokeWidth={1.7} />
              {s.area}
            </span>
            <span className="sr-only">{categoryName}</span>
          </p>
        </div>
        <div className="row-span-2 self-start pt-1">
          <SeatCircle
            decorative
            capacity={s.capacity}
            taken={s.reserved_count}
            closed={Boolean(line.notOpen)}
            you={line.closed || line.notOpen ? false : "open"}
            face={face}
            initial={host?.display_name.slice(0, 1) ?? meetup.title.slice(0, 1)}
          />
        </div>
        {/* 참가비 · 남은 자리 · 후기 */}
        <div className="col-span-2 mt-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3.5 pl-11">
          <b className="font-num text-[17px] font-semibold">{meetup.price > 0 ? formatPrice(meetup.price) : "무료"}</b>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[14.5px] font-bold",
              line.closed ? "bg-muted text-muted-foreground" : line.left <= 2 ? "bg-gold text-gold-ink" : "border border-gold bg-gold/20 text-forest",
            )}
            data-testid="card-seats"
          >
            {line.text}
            <span className="sr-only"> · 정원 {s.capacity}명</span>
          </span>
          {trust && trust.count > 0 && trust.avg != null && (
            <span className="inline-flex w-full items-center gap-1 text-[14.5px] text-muted-foreground" data-testid="card-reviews">
              <Star aria-hidden className="size-3.5 fill-gold text-gold" />
              <b className="text-foreground">{trust.avg.toFixed(1)}</b> · 이 크리에이터 후기 {trust.count}개
            </span>
          )}
        </div>
      </Link>
      <SaveButton item={{ id: meetup.id, title: meetup.title, meta }} tone="dark" className="absolute bottom-3 left-3 size-8 sm:bottom-4 sm:left-4" />
    </div>
  );
}

export function CircleGrid({
  meetups,
  categoryNames,
  trust,
}: {
  meetups: MeetupCardData[];
  categoryNames: Record<string, string>;
  /** 크리에이터별 실제 후기 요약 (있으면 카드에 표시) */
  trust?: Record<string, ReviewSummary>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3" data-testid="meetup-grid">
      {meetups.map((m) => (
        <CircleCard key={m.id} meetup={m} categoryName={categoryNames[m.category_slug] ?? m.category_slug} trust={m.host ? trust?.[m.host.user_id] : undefined} />
      ))}
    </div>
  );
}
