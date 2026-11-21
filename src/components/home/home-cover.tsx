import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LogoWordmarkChair } from "@/components/brand/logo";
import { Photo } from "@/components/media/photo";
import { ISSUE } from "@/config/issue";
import { pillarInfo } from "@/config/pillars";
import { ticketDate } from "@/lib/format";
import { creatorPhoto, hostHref } from "@/lib/hosting/avatar";
import type { HostDetail, MeetupCardData } from "@/lib/meetups/queries";

/*
 * 홈 표지 (대표 선택 2026-11-21, 시안 10번 "에디토리얼 매거진"):
 * 호 정보 → 큰 제호(O 자리에 시그니처 의자 — 절대 규칙) → 섞은 타이포 카피 → 오른쪽으로 치우친 표지 인물 + 겹친 소프트 블루 설명 박스.
 * 인물·프로그램은 실제 데이터만(사진이 있는 크리에이터가 표지 인물).
 */
export function HomeCover({ meetups, people }: { meetups: MeetupCardData[]; people: HostDetail[] }) {
  const cover = people.find((h) => creatorPhoto(h)) ?? null;
  const photo = cover ? creatorPhoto(cover) : null;
  const program = cover ? meetups.find((m) => m.host?.user_id === cover.user_id) : undefined;
  const s = program?.nextSession;
  const d = s ? ticketDate(s.starts_at) : null;
  const role = cover ? cover.occupation || cover.headline || pillarInfo(cover.primary_pillar)?.ko || "" : "";
  return (
    <section aria-labelledby="hero-title">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <p className="cap cap-kr flex justify-between pt-3 text-[11.5px] text-muted-foreground">
          <span>
            Issue {String(ISSUE.no).padStart(2, "0")} — {ISSUE.season}
          </span>
          <span>{ISSUE.place}</span>
        </p>
        <LogoWordmarkChair className="mt-3 w-full text-brand" />
        <div className="mt-3 border-t border-foreground" />

        <div className="mt-9 md:grid md:grid-cols-[1.05fr_1fr] md:items-start md:gap-16">
          <div>
            <p className="cap cap-kr text-brand">— 사람을 큐레이팅하는 곳</p>
            <h1 id="hero-title" className="mt-5 leading-[1.05] tracking-[-0.06em] break-keep">
              <span className="block text-[52px] sm:text-[84px]" style={{ fontWeight: 200 }}>한 사람의</span>
              <span className="font-display ml-[30px] block text-[52px] text-brand sm:ml-[56px] sm:text-[84px]" style={{ fontWeight: 600 }}>세계를</span>
              <span className="block text-[52px] sm:text-[84px]" style={{ fontWeight: 800 }}>만나는 자리</span>
            </h1>
            <p className="it-serif mt-4 text-[30px] text-brand sm:text-[40px]">a table for four to ten.</p>
            <p className="mt-6 ml-[74px] max-w-sm text-[15.5px] leading-[1.8] text-muted-foreground sm:text-[17px]">
              자기만의 작업과 관점을 가진 사람과 4~10명이 둘러앉아요. 결제와 환불은 라운디 안에서만 해요.
            </p>
          </div>

          {cover && (
            <div className="relative mt-10 mb-24 pl-[46px] md:mt-2 md:mb-16 md:pl-0">
              <Link href={hostHref(cover)} className="relative block aspect-[4/5.1] overflow-hidden bg-muted" data-testid="cover-story">
                <Photo src={photo} alt={`${cover.display_name} 사진`} priority sizes="(min-width: 768px) 45vw, 90vw" className="object-[50%_8%]" fallback={null} />
              </Link>
              <span className="cap cap-kr absolute top-2 left-2 text-[11.5px] text-muted-foreground [writing-mode:vertical-rl] rotate-180 md:hidden">Cover story — {cover.display_name}</span>
              <div className="absolute bottom-[-64px] left-3.5 w-[252px] bg-soft p-4 md:left-[-28px] md:w-[300px] md:p-5">
                <p className="cap cap-kr text-brand">{role}</p>
                <p className="font-display mt-1 text-[27px] leading-tight">{cover.display_name}</p>
                {program && s && d && (
                  <>
                    <p className="mt-2 text-[14.5px] leading-snug">{program.title}</p>
                    <p className="cap cap-kr mt-2 text-[12.5px] text-muted-foreground">
                      {d.md} {d.wd} {d.time} · {s.area}
                    </p>
                    <Link href={`/meetups/${program.id}`} className="mt-3 inline-flex items-center gap-1.5 text-[14.5px] font-bold text-brand hover:underline" data-testid="cover-cta">
                      자리 보기
                      <ArrowRight aria-hidden className="size-4" strokeWidth={1.6} />
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
