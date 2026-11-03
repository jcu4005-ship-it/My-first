import Link from "next/link";

import { formatPrice, formatShortDateTime } from "@/lib/format";
import type { MeetupCardData } from "@/lib/meetups/queries";

import { SampleBadge, SeatsBadge } from "./badges";
import { EditorialCover } from "./editorial-cover";

export function MeetupCard({ meetup, categoryName }: { meetup: MeetupCardData; categoryName: string }) {
  const s = meetup.nextSession;
  return (
    <Link href={`/meetups/${meetup.id}`} className="group flex flex-col gap-3" data-testid="meetup-card">
      <div className="relative overflow-hidden rounded-2xl">
        <EditorialCover
          category={meetup.category_slug}
          categoryName={categoryName}
          title={meetup.title}
          area={s.area}
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>
      <div className="flex flex-col gap-1 px-0.5">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {meetup.is_sample && <SampleBadge />}
          {categoryName} · {formatShortDateTime(s.starts_at)}
          {meetup.upcomingSessions.length > 1 && ` 외 ${meetup.upcomingSessions.length - 1}회`}
        </p>
        <h3 className="line-clamp-2 font-semibold leading-snug group-hover:underline group-hover:underline-offset-4">
          {meetup.title}
        </h3>
        <div className="mt-1 flex items-center justify-between">
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
    <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3" data-testid="meetup-grid">
      {meetups.map((m) => (
        <MeetupCard key={m.id} meetup={m} categoryName={categoryNames[m.category_slug] ?? m.category_slug} />
      ))}
    </div>
  );
}
