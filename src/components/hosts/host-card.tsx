import Link from "next/link";

import { Photo } from "@/components/media/photo";
import { pillarInfo } from "@/config/pillars";
import { creatorPhoto, hostHref } from "@/lib/hosting/avatar";
import type { HostDetail, MeetupCardData } from "@/lib/meetups/queries";

/**
 * 크리에이터 타일 (드롭 × 모닥불 원): 사진(없으면 분야 색 + 이름) · 이름 · 하는 일 · 다음 원 / 지금 남은 자리.
 * 많아져도 촘촘하게(휴대폰 3열 · PC 6열). 숫자는 실제 일정·예약 수만.
 */
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
  const avatar = creatorPhoto(host);
  const s = representative?.nextSession;
  const left = s ? Math.max(0, s.capacity - s.reserved_count) : 0;
  const next = s ? (s.status === "open" && left > 0 ? `지금 ${left}자리` : "원이 가득 찼어요") : "다음 원 준비 중";
  const tone = pillar?.slug === "knowledge" ? "bg-navy-3" : pillar?.slug === "experts" ? "bg-navy-2" : "bg-navy";
  return (
    <div className={`flex h-full flex-col ${className}`} data-testid="host-card" data-name={host.display_name}>
      <Link href={hostHref(host)} className="group flex flex-col" data-testid="expert-card">
        <span className={`relative block aspect-[4/5] overflow-hidden rounded-[18px] ${avatar ? "bg-muted" : tone}`}>
          {avatar ? (
            <Photo src={avatar} alt={`${host.display_name} 프로필 사진`} sizes="(min-width: 1024px) 200px, 33vw" fallback={null} className="object-[50%_18%] transition-transform duration-500 group-hover:scale-[1.03]" />
          ) : (
            <span aria-hidden className="absolute inset-x-0 bottom-0 p-2.5 font-display text-[16px] leading-tight font-bold tracking-[-0.02em] break-keep text-white sm:p-3.5 sm:text-[19px]">
              {host.display_name}
            </span>
          )}
        </span>
        <span className="mt-2 block min-w-0">
          <span className="block truncate text-[14.5px] font-bold group-hover:underline group-hover:underline-offset-4 sm:text-[16px]">{host.display_name}</span>
          <span className="block truncate text-[13.5px] text-muted-foreground sm:text-[14px]">{host.occupation || host.headline || pillar?.ko}</span>
        </span>
      </Link>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13.5px] sm:text-[14.5px]">
        {representative ? (
          <Link href={`/meetups/${representative.id}`} className="font-bold text-forest hover:underline" aria-label={`대표 프로그램 ${representative.title}`}>
            {next}
          </Link>
        ) : (
          <span className="text-muted-foreground">{next}</span>
        )}
        {host.is_sample && <span className="text-muted-foreground">· 샘플 호스트</span>}
        {!host.is_sample && !host.bio && !host.headline && (
          <span className="text-muted-foreground" data-testid="host-pending">소개 준비 중</span>
        )}
      </span>
    </div>
  );
}

/**
 * 크리에이터 타일 (메인 "만나 볼 사람들"): 전시장의 작품처럼 사람을 크게 보여 줌.
 * 사진이 없으면 이름 첫 글자를 큰 활자로. 아래에 이름·하는 일·분야·프로그램 수.
 */
export function CreatorTile({ host, programCount }: { host: HostDetail; programCount: number }) {
  const pillar = pillarInfo(host.primary_pillar);
  const avatar = creatorPhoto(host);
  const pending = !host.is_sample && !host.bio && !host.headline;
  return (
    <Link href={hostHref(host)} className="group block" data-testid="creator-tile" data-name={host.display_name}>
      <span className="relative block aspect-[3/4] overflow-hidden rounded-[20px] bg-[linear-gradient(160deg,#2f4a3a_0%,#23332a_100%)] shadow-[0_18px_30px_-22px_rgb(35_51_42/0.7)]">
        {avatar ? (
          <Photo src={avatar} alt={`${host.display_name} 프로필 사진`} sizes="(min-width: 640px) 240px, 44vw" fallback={null} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center font-display text-[5.5rem] leading-none text-cream/85">
            {host.display_name.slice(0, 1)}
          </span>
        )}
        {pillar && (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[13.5px] font-semibold tracking-[0.12em] text-foreground">
            {pillar.label.toUpperCase()}
          </span>
        )}
      </span>
      <span className="mt-2.5 block px-0.5">
        <span className="block truncate font-display text-[17px] font-bold group-hover:underline group-hover:underline-offset-4">{host.display_name}</span>
        <span className="block truncate text-[14.5px] text-muted-foreground">{host.occupation || host.headline || pillar?.ko}</span>
        <span className="mt-1 block text-[14.5px] font-semibold text-forest">
          {programCount > 0 ? `프로그램 ${programCount}개` : pending ? "소개 준비 중" : "새 프로그램 준비 중"}
        </span>
      </span>
    </Link>
  );
}
