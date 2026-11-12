import Link from "next/link";
import { CalendarDays, Users } from "lucide-react";

import { Photo } from "@/components/media/photo";
import { formatPrice, formatShortDateTime } from "@/lib/format";
import type { MeetupCardData } from "@/lib/meetups/queries";
import { cn } from "@/lib/utils";

import { SampleBadge, SeatsBadge } from "./badges";
import { EditorialCover } from "./editorial-cover";

/**
 * 프로그램 카드: 사진 → 제목 → 호스트 → 일정·자리 → 참가비
 * mobileRow: 휴대폰에서는 왼쪽 작은 사진 + 오른쪽 정보의 한 줄 카드 (목록을 한눈에 훑기 쉽게)
 */
export function MeetupCard({ meetup, categoryName, mobileRow = false }: { meetup: MeetupCardData; categoryName: string; mobileRow?: boolean }) {
  const s = meetup.nextSession;
  return (
    <Link
      href={`/meetups/${meetup.id}`}
      className={cn("group flex h-full overflow-hidden rounded-2xl border border-border/70 bg-card transition-shadow", mobileRow ? "flex-row sm:flex-col" : "flex-col", "hover:shadow-[0_8px_24px_-12px_rgb(31_51_41/0.25)]")}
      data-testid="meetup-card"
    >
      <div className={cn("relative overflow-hidden bg-forest", mobileRow ? "w-28 shrink-0 sm:aspect-[4/3] sm:w-auto" : "aspect-[4/3]")}>
        <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03]">
          <Photo
            src={meetup.cover_image_url}
            alt={meetup.title}
            fallback={<EditorialCover category={meetup.category_slug} title={meetup.title} showTitle={false} showLabel={false} />}
          />
        </div>
        <span className={cn("pill absolute top-3 left-3 bg-white/95 text-forest shadow-sm", mobileRow && "hidden sm:inline-flex")}>{categoryName}</span>
        {meetup.is_sample && <SampleBadge className={cn("absolute", mobileRow ? "top-2 left-2 sm:top-3 sm:right-3 sm:left-auto" : "top-3 right-3")} />}
      </div>
      <div className={cn("flex min-w-0 flex-1 flex-col", mobileRow ? "gap-2 p-3 sm:gap-3 sm:p-4" : "gap-3 p-4")}>
        {mobileRow && <span className="text-xs font-medium text-forest sm:hidden">{categoryName}</span>}
        <h3 className="line-clamp-2 text-base leading-snug font-semibold break-keep">{meetup.title}</h3>
        {meetup.host && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-linen text-[11px] font-semibold text-forest">
              {meetup.host.display_name.slice(0, 1)}
            </span>
            <span className="truncate">by {meetup.host.display_name}</span>
          </p>
        )}
        <div className="mt-auto flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <CalendarDays aria-hidden className="size-4 shrink-0" strokeWidth={1.6} />
            <span className="truncate">
              {formatShortDateTime(s.starts_at)}
              {meetup.upcomingSessions.length > 1 && ` 외 ${meetup.upcomingSessions.length - 1}회`} · {s.area}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <Users aria-hidden className="size-4 shrink-0" strokeWidth={1.6} />
            <SeatsBadge session={s} />
          </p>
        </div>
        <p className={cn("border-t border-border/70 text-base font-bold text-forest", mobileRow ? "pt-2 sm:pt-3" : "pt-3")}>{formatPrice(meetup.price)}</p>
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3" data-testid="meetup-grid">
      {meetups.map((m) => (
        <MeetupCard key={m.id} meetup={m} categoryName={categoryNames[m.category_slug] ?? m.category_slug} mobileRow />
      ))}
    </div>
  );
}
