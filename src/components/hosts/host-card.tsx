import Link from "next/link";

import { Photo } from "@/components/media/photo";
import { pillarInfo } from "@/config/pillars";
import { hostAvatarUrl, hostHref } from "@/lib/hosting/avatar";
import type { HostDetail, MeetupCardData } from "@/lib/meetups/queries";

/** 호스트 카드: 동그란 사진(없으면 이니셜) + 이름 + 하는 일 + 분야, 아래에 대표 프로그램 */
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
    <div className={`flex h-full flex-col rounded-2xl border border-border/70 bg-card p-5 ${className}`} data-testid="host-card" data-name={host.display_name}>
      <Link href={hostHref(host)} className="group flex flex-col gap-4" data-testid="expert-card">
        <span className="flex items-center gap-3">
          <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest font-display text-xl text-cream">
            {avatar ? (
              <Photo src={avatar} alt={`${host.display_name} 프로필 사진`} sizes="56px" fallback={null} />
            ) : (
              <span aria-hidden>{host.display_name.slice(0, 1)}</span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold group-hover:underline group-hover:underline-offset-4">{host.display_name}</span>
            <span className="block truncate text-sm text-muted-foreground">{host.occupation || host.headline}</span>
          </span>
        </span>
        <span className="flex flex-wrap gap-1.5">
          {pillar && <span className="pill bg-forest/10 text-forest">{pillar.ko}</span>}
          {host.expertise.slice(0, 2).map((e) => (
            <span key={e} className="pill bg-linen text-foreground/80">{e}</span>
          ))}
          {host.is_sample && <span className="pill bg-linen text-muted-foreground">샘플 호스트</span>}
          {!host.is_sample && !host.bio && !host.headline && (
            <span className="pill bg-linen text-muted-foreground" data-testid="host-pending">소개 준비 중</span>
          )}
        </span>
      </Link>
      {representative && (
        <Link href={`/meetups/${representative.id}`} className="mt-4 line-clamp-1 border-t border-border/70 pt-3 text-sm text-muted-foreground hover:text-foreground">
          대표 프로그램 · <span className="text-foreground">{representative.title}</span>
        </Link>
      )}
    </div>
  );
}
