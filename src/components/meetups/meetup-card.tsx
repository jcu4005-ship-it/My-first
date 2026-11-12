import Link from "next/link";
import { CalendarDays, Users } from "lucide-react";

import { Photo } from "@/components/media/photo";
import { formatPrice, formatShortDateTime } from "@/lib/format";
import type { MeetupCardData } from "@/lib/meetups/queries";

import { SampleBadge, SeatsBadge } from "./badges";
import { EditorialCover } from "./editorial-cover";

/** 프로그램 카드: 사진 → 제목 → 호스트 → 일정·자리 → 참가비 */
export function MeetupCard({ meetup, categoryName }: { meetup: MeetupCardData; categoryName: string }) {
  const s = meetup.nextSession;
  return (
    <Link
      href={`/meetups/${meetup.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-shadow hover:shadow-[0_8px_24px_-12px_rgb(31_51_41/0.25)]"
      data-testid="meetup-card"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-forest">
        <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03]">
          <Photo
            src={meetup.cover_image_url}
            alt={meetup.title}
            fallback={<EditorialCover category={meetup.category_slug} title={meetup.title} showTitle={false} showLabel={false} />}
          />
        </div>
        <span className="pill absolute top-3 left-3 bg-white/95 text-forest shadow-sm">{categoryName}</span>
        {meetup.is_sample && <SampleBadge className="absolute top-3 right-3" />}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
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
        <p className="border-t border-border/70 pt-3 text-base font-bold text-forest">{formatPrice(meetup.price)}</p>
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
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="meetup-grid">
      {meetups.map((m) => (
        <MeetupCard key={m.id} meetup={m} categoryName={categoryNames[m.category_slug] ?? m.category_slug} />
      ))}
    </div>
  );
}
