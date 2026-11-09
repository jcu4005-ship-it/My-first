import Link from "next/link";

import { Photo } from "@/components/media/photo";
import { formatPrice, formatShortDateTime } from "@/lib/format";
import type { MeetupCardData } from "@/lib/meetups/queries";
import { cn } from "@/lib/utils";

import { SampleBadge, SeatsBadge } from "./badges";
import { categoryStyle } from "./category-style";
import { EditorialCover } from "./editorial-cover";

/** 사진이 먼저 보이는 프로그램 카드 */
export function MeetupCard({
  meetup,
  categoryName,
  variant = "default",
}: {
  meetup: MeetupCardData;
  categoryName: string;
  variant?: "default" | "feature";
}) {
  const s = meetup.nextSession;
  const label = categoryStyle(meetup.category_slug).label;
  return (
    <Link href={`/meetups/${meetup.id}`} className="group flex flex-col gap-4" data-testid="meetup-card">
      <div className={cn("relative overflow-hidden bg-espresso", variant === "feature" ? "aspect-[4/5]" : "aspect-[4/5] sm:aspect-[3/4]")}>
        <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03]">
          <Photo
            src={meetup.cover_image_url}
            alt={meetup.title}
            fallback={<EditorialCover category={meetup.category_slug} title={meetup.title} />}
          />
        </div>
        {meetup.is_sample && <SampleBadge className="absolute top-4 right-4" />}
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="eyebrow text-muted-foreground">
          {label} <span className="mx-1 opacity-50">/</span> {s.area}
        </p>
        <h3 className="line-clamp-2 font-display text-lg leading-snug font-medium break-keep group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
          {meetup.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          <span className="sr-only">{categoryName} · </span>
          {formatShortDateTime(s.starts_at)}
          {meetup.upcomingSessions.length > 1 && ` 외 ${meetup.upcomingSessions.length - 1}회`}
          {meetup.host && <> · {meetup.host.display_name}</>}
        </p>
        <div className="mt-1 flex items-center justify-between border-t pt-2">
          <span className="text-sm font-semibold">{formatPrice(meetup.price)}</span>
          <SeatsBadge session={s} />
        </div>
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
    <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3" data-testid="meetup-grid">
      {meetups.map((m) => (
        <MeetupCard key={m.id} meetup={m} categoryName={categoryNames[m.category_slug] ?? m.category_slug} />
      ))}
    </div>
  );
}
