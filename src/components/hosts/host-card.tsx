import Link from "next/link";

import { Photo } from "@/components/media/photo";
import { pillarInfo } from "@/config/pillars";
import { hostAvatarUrl } from "@/lib/hosting/avatar";
import type { HostDetail, MeetupCardData } from "@/lib/meetups/queries";
import { hostHref } from "@/lib/hosting/avatar";

/** 호스트 카드: 이미지(준비 전에는 이니셜 표지), 이름, 전문 분야, 짧은 소개, 대표 프로그램 */
export function HostCard({
  host,
  representative,
  className = "",
}: {
  host: HostDetail & { pillars?: string[] };
  representative?: MeetupCardData | null;
  className?: string;
}) {
  const pillar = pillarInfo(host.primary_pillar ?? host.pillars?.[0]);
  const avatar = hostAvatarUrl(host.avatar_path);
  return (
    <div className={`flex flex-col ${className}`} data-testid="host-card" data-name={host.display_name}>
      <Link href={hostHref(host)} className="group flex flex-col" data-testid="expert-card">
        <span className="relative flex aspect-[4/5] items-end overflow-hidden bg-espresso p-5 text-sand-light">
          {avatar ? (
            <>
              <Photo src={avatar} alt={`${host.display_name} 프로필 사진`} sizes="(min-width: 1024px) 25vw, 60vw" fallback={null} />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-espresso/85 via-espresso/10 to-transparent" />
            </>
          ) : (
            <span aria-hidden className="absolute -top-4 -right-2 font-display text-[9rem] leading-none font-bold opacity-[0.08]">
              {host.display_name.slice(0, 1)}
            </span>
          )}
          <span className="relative flex flex-col gap-1">
            {pillar && <span className="eyebrow text-[#d9b39e]">{pillar.label}</span>}
            <span className="eyebrow text-sand">{host.expertise.slice(0, 2).join(" · ") || "Host"}</span>
          </span>
        </span>
        <span className="mt-4 font-display text-xl font-medium group-hover:underline group-hover:underline-offset-4">{host.display_name}</span>
        <span className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{host.occupation || host.headline}</span>
        {host.is_sample && <span className="mt-1 text-[11px] text-muted-foreground">샘플 호스트</span>}
      </Link>
      {representative && (
        <Link href={`/meetups/${representative.id}`} className="mt-3 border-t pt-3 text-sm hover:underline hover:underline-offset-4">
          <span className="eyebrow mr-2 text-muted-foreground">Program</span>
          {representative.title}
        </Link>
      )}
    </div>
  );
}
