import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LogoWordmarkChair } from "@/components/brand/logo";
import { CoverRotator } from "@/components/home/cover-rotator";
import { Photo } from "@/components/media/photo";
import { brand } from "@/config/brand";
import { ISSUE } from "@/config/issue";
import { pillarInfo } from "@/config/pillars";
import { creatorPhoto, hostHref } from "@/lib/hosting/avatar";
import type { HostDetail, MeetupCardData } from "@/lib/meetups/queries";

/*
 * 잡지 표지 (대표 선택 2026-11-21 "3번"): 큰 제호(로고 의자 O, 초록) → 호 정보 띠 → 표지 인물 사진 + 카피 + 이번 호 목차.
 * 홈과 라운디 이야기(/about)가 같이 씁니다. 인물·프로그램은 실제 데이터만.
 */
export function MagazineCover({ meetups, people }: { meetups: MeetupCardData[]; people: HostDetail[] }) {
  const slides = people.flatMap((h) => {
    const photo = creatorPhoto(h);
    return photo ? [{ href: hostHref(h), name: h.display_name, role: h.occupation || h.headline || pillarInfo(h.primary_pillar)?.ko || "", photo }] : [];
  });
  const index = people.slice(0, 3);
  return (
    <section aria-labelledby="hero-title">
      <div className="mx-auto w-full max-w-6xl px-4 pt-1 sm:px-6">
        <LogoWordmarkChair className="w-full text-brand" />
        <div className="mt-3 flex justify-between border-y border-foreground py-2 text-[9.5px] font-bold tracking-[0.16em] sm:mt-4 sm:border-t-2 sm:text-[11.5px] sm:tracking-[0.18em]">
          <span>
            ISSUE No.{String(ISSUE.no).padStart(2, "0")} — {ISSUE.season}
          </span>
          <span className="hidden sm:inline">{brand.tagline.replace(/\.$/, "")}</span>
          <span>{ISSUE.place}</span>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-4 sm:px-6 sm:pt-8 lg:grid-cols-[5fr_4.2fr_2.8fr] lg:gap-9">
        {/* 표지 사진 (휴대폰에서는 맨 위) */}
        {/* 표지 사진 (휴대폰에서는 맨 위) — 사진이 있는 크리에이터를 2초마다 돌아가며 */}
        <CoverRotator slides={slides} />

        <div className="flex flex-col justify-end lg:order-1 lg:pb-1">
          <p className="text-[10.5px] font-bold tracking-[0.26em] text-ember uppercase">{brand.name}</p>
          <h1 id="hero-title" className="mt-3 text-[34px] leading-[1.13] font-extrabold tracking-[-0.045em] break-keep sm:text-[64px] sm:leading-[1.06]">
            당신만의 세계가
            <br />
            누군가에게는
            <br />
            새로운 세계가 됩니다.
          </h1>
          <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-foreground/80 sm:mt-6 sm:text-[17px]">
            자기만의 작업과 관점을 가진 사람을 발견하고, 4~10명의 작은 자리로 연결합니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5 sm:mt-8">
            <Link href="/hosts" className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-[14.5px] font-bold text-background" data-testid="hero-cta">
              크리에이터 만나 보기
              <ArrowRight aria-hidden className="size-4" strokeWidth={1.8} />
            </Link>
            <Link href="/meetups" className="inline-flex h-12 items-center rounded-full border-[1.5px] border-foreground px-6 text-[14.5px] font-bold">
              프로그램
            </Link>
          </div>
        </div>

        {/* 이번 호 목차 */}
        {index.length > 0 && (
          <nav aria-label="이번 호의 크리에이터" className="lg:order-3">
            <p className="border-b border-foreground pb-2.5 text-[10.5px] font-extrabold tracking-[0.26em]">IN THIS ISSUE</p>
            <ol>
              {index.map((h, i) => {
                const photo = creatorPhoto(h);
                const program = meetups.find((m) => m.host?.user_id === h.user_id);
                return (
                  <li key={h.user_id} className="border-b border-border">
                    <Link href={hostHref(h)} className="group grid grid-cols-[24px_1fr_52px] items-center gap-3 py-3.5 sm:grid-cols-[24px_1fr_64px]">
                      <span className="text-[12px] font-extrabold text-ember">{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0">
                        <b className="block text-[15.5px] group-hover:underline group-hover:underline-offset-4">{h.display_name}</b>
                        <span className="block truncate text-[12px] text-fog">
                          {[pillarInfo(h.primary_pillar)?.ko, program?.title ?? h.occupation].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="relative block h-16 w-[52px] overflow-hidden rounded-[2px] bg-linen sm:h-20 sm:w-16">
                        <Photo src={photo} alt="" sizes="64px" fallback={<span aria-hidden className="absolute inset-0 flex items-center justify-center font-display text-lg text-fog">{h.display_name.slice(0, 1)}</span>} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
      </div>
    </section>
  );
}
