import { LogoWordmarkChair } from "@/components/brand/logo";
import { ProgramSlider, type ProgramSlide } from "@/components/home/program-slider";
import { seatLine } from "@/components/meetups/circle-card";
import { ISSUE } from "@/config/issue";
import { pillarInfo } from "@/config/pillars";
import { formatPrice, ticketDate } from "@/lib/format";
import { creatorPhoto, hostHref } from "@/lib/hosting/avatar";
import type { HostDetail, MeetupCardData } from "@/lib/meetups/queries";

/*
 * 홈 표지 (대표 선택 2026-11-21, 시안 10번 "에디토리얼 매거진"):
 * 호 정보 → 큰 제호(O 자리에 시그니처 의자 — 절대 규칙) → 섞은 타이포 카피 → 오른쪽으로 치우친 표지 인물 + 겹친 소프트 블루 설명 박스.
 * 인물·프로그램은 실제 데이터만(사진이 있는 크리에이터가 표지 인물).
 */
export function HomeCover({ meetups, people }: { meetups: MeetupCardData[]; people: HostDetail[] }) {
  // 슬라이드: 사진이 있는 크리에이터마다 그 사람의 가장 가까운 프로그램 (크리에이터 순서대로 돌아감)
  const slides: ProgramSlide[] = people.flatMap((h) => {
    const photo = creatorPhoto(h);
    const m = meetups.find((x) => x.host?.user_id === h.user_id);
    if (!photo || !m) return [];
    const s = m.nextSession;
    const d = ticketDate(s.starts_at);
    const line = seatLine(s);
    return [
      {
        href: `/meetups/${m.id}`,
        hostHref: hostHref(h),
        name: h.display_name,
        role: h.occupation || h.headline || pillarInfo(h.primary_pillar)?.ko || "",
        photo,
        title: m.title,
        when: `${d.md} ${d.wd} ${d.time}`,
        place: s.area,
        price: m.price > 0 ? formatPrice(m.price) : "무료",
        seats: line.text,
        closed: line.closed,
        sample: m.is_sample,
      },
    ];
  });
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

        {/* 제호 바로 아래: 프로그램(주인공)과 크리에이터 사진이 2초마다 돌아가며 바뀜 */}
        <div className="mt-6 -mx-5 sm:mx-0">
          <ProgramSlider slides={slides} />
        </div>

        <div className="mt-14">
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
      </div>
    </section>
  );
}
