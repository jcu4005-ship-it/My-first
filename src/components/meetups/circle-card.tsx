import Link from "next/link";
import { BadgeCheck, Star } from "lucide-react";

import { Photo } from "@/components/media/photo";
import { SaveButton } from "@/components/saved";
import { formatPrice, ticketDate } from "@/lib/format";
import { creatorPhoto } from "@/lib/hosting/avatar";
import { isVerifiedHost } from "@/lib/hosting/demo";
import { isNotYetOpen, opensLabel } from "@/lib/meetups/drops";
import type { MeetupCardData, Session } from "@/lib/meetups/queries";
import type { ReviewSummary } from "@/lib/reviews/queries";
import { cn } from "@/lib/utils";

import { seatsLeft } from "./badges";

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
export function hostVerified(h: { headline?: string | null; bio?: string | null; philosophy?: string | null; career?: string | null; is_sample?: boolean } | null | undefined) {
  return isVerifiedHost(h);
}

/**
 * 프로그램 카드 (갤러리 스타일): 큰 사진(크리에이터) → 제목 → 크리에이터·날짜·장소 → 참가비·남은 자리 → 환불 날짜 → 후기.
 * 후기는 실제 공개 후기가 있을 때만. 샘플은 "샘플" 표시.
 */
export function CircleCard({ meetup, categoryName, trust, large }: { meetup: MeetupCardData; categoryName: string; trust?: ReviewSummary; large?: boolean }) {
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
      <Link href={`/meetups/${meetup.id}`} className="group block h-full" data-testid="meetup-card">
        <span className={cn("relative block overflow-hidden bg-[linear-gradient(160deg,#e3ded0,#cfc9ba)]", large ? "aspect-[3/2]" : "aspect-[4/5]")}>
          <Photo
            src={face}
            alt={host ? `${host.display_name} 크리에이터 사진` : meetup.title}
            sizes={large ? "100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"}
            className="object-[50%_12%] transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            fallback={
              <span aria-hidden className="absolute inset-0 flex items-center justify-center font-display text-[6rem] text-foreground/15">
                {host?.display_name.slice(0, 1) ?? meetup.title.slice(0, 1)}
              </span>
            }
          />
          {meetup.is_sample && <span className="absolute top-2.5 left-2.5 bg-card/95 px-2 py-0.5 text-[12px] font-semibold" data-testid="sample-badge">샘플</span>}
        </span>
        <span className="cap cap-kr mt-3 flex justify-between gap-2 text-muted-foreground">
          <span>{d.md} {d.wd} {d.time}{more > 0 && ` 외 ${more}회`}</span>
          <span>{s.area}</span>
        </span>
        <h3 className={cn("font-display mt-1.5 line-clamp-2 leading-snug break-keep group-hover:underline group-hover:underline-offset-4", large ? "text-[24px]" : "text-[19px]")}>{meetup.title}</h3>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[14px] leading-snug text-muted-foreground">
          {host && <span className="inline-flex items-center gap-1 font-semibold text-foreground">{host.display_name}{verified && <BadgeCheck aria-label="운영팀 심사를 통과한 크리에이터" className="size-4 text-brand" strokeWidth={1.8} />}</span>}
          <span className="sr-only">{categoryName}</span>
        </p>
        <p className="mt-2 flex items-baseline justify-between gap-2 border-t border-border pt-2 text-[15px]">
          <b className="font-num font-medium">{meetup.price > 0 ? formatPrice(meetup.price) : "무료"}</b>
          <b className={cn("text-right text-[13.5px] font-semibold", line.closed ? "text-muted-foreground" : "text-brand")} data-testid="card-seats">
            {line.text}
            <span className="sr-only"> · 정원 {s.capacity}명</span>
          </b>
        </p>
        {trust && trust.count > 0 && trust.avg != null && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-[13.5px] text-muted-foreground" data-testid="card-reviews">
            <Star aria-hidden className="size-3.5 fill-foreground text-foreground" />
            <b className="text-foreground">{trust.avg.toFixed(1)}</b> · 이 크리에이터 후기 {trust.count}개
          </p>
        )}
      </Link>
      <SaveButton item={{ id: meetup.id, title: meetup.title, meta }} tone="dark" className="absolute top-2.5 right-2.5 size-9" />
    </div>
  );
}

export function CircleGrid({
  meetups,
  categoryNames,
  trust,
  editorial = false,
}: {
  meetups: MeetupCardData[];
  categoryNames: Record<string, string>;
  /** 크리에이터별 실제 후기 요약 (있으면 카드에 표시) */
  trust?: Record<string, ReviewSummary>;
  /** 첫 카드를 크게, 둘째 줄부터 엇갈려 배치 (홈 갤러리) */
  editorial?: boolean;
}) {
  const t = (m: MeetupCardData) => (m.host ? trust?.[m.host.user_id] : undefined);
  const name = (m: MeetupCardData) => categoryNames[m.category_slug] ?? m.category_slug;
  if (editorial && meetups.length > 0) {
    const [first, ...rest] = meetups;
    return (
      <div data-testid="meetup-grid">
        <CircleCard meetup={first} categoryName={name(first)} trust={t(first)} large />
        {rest.length > 0 && (
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {rest.map((m, i) => (
              <div key={m.id} className={i % 2 === 1 ? "mt-10 lg:mt-0" : undefined}>
                <CircleCard meetup={m} categoryName={name(m)} trust={t(m)} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4" data-testid="meetup-grid">
      {meetups.map((m) => (
        <CircleCard key={m.id} meetup={m} categoryName={name(m)} trust={t(m)} />
      ))}
    </div>
  );
}
