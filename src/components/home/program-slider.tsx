"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type ProgramSlide = {
  href: string;
  hostHref: string;
  name: string;
  role: string;
  photo: string;
  title: string;
  when: string;
  place: string;
  price: string;
  seats: string;
  closed: boolean;
  sample: boolean;
};

const INTERVAL_MS = 2000;

/**
 * 홈 맨 위 프로그램 슬라이드 (대표 요청 2026-11-21): ROUNDI 제호 바로 아래에서
 * 크리에이터 사진이 2초마다 돌아가며 바뀌고, 사진 아래에 그 크리에이터의 프로그램(제목·날짜·장소·참가비·남은 자리)이 같이 바뀝니다.
 * - 마우스를 올리거나 키보드로 가리키면 멈춤(읽는 중에 바뀌지 않게). "동작 줄이기" 설정이면 자동으로 바꾸지 않고 점으로 넘김.
 * - 사진은 처음부터 모두 겹쳐 두고 투명도만 바꿔 빈 화면이 생기지 않음. 숫자·문구는 실제 프로그램 데이터만.
 */
export function ProgramSlider({ slides }: { slides: ProgramSlide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (slides.length < 2 || paused || reduced) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % slides.length), INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [slides.length, paused, reduced]);

  if (!slides.length) return null;
  const at = i % slides.length;
  const cur = slides[at];

  return (
    <div
      className="relative"
      data-testid="home-slider"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Link
        href={cur.hostHref}
        className="group relative block aspect-[4/4.7] overflow-hidden bg-muted md:aspect-[16/9]"
        data-testid="cover-story"
        aria-label={`${cur.name} — ${cur.role}`}
      >
        {slides.map((s, n) => (
          <Image
            key={s.href}
            src={s.photo}
            alt=""
            fill
            priority={n === 0}
            sizes="(min-width: 1152px) 1152px, 100vw"
            unoptimized={/^https?:\/\//.test(s.photo)}
            className={cn(
              "object-cover object-[50%_14%] transition-[opacity,transform] duration-700 ease-out group-hover:scale-[1.02]",
              n === at ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
        {cur.sample && <span className="absolute top-3 left-5 bg-card/95 sm:left-3 px-2 py-0.5 text-[12px] font-semibold">샘플</span>}
        <span className="cap absolute right-5 bottom-3 sm:right-3 bg-card/90 px-2.5 py-1 text-[11.5px]" aria-hidden>
          {String(at + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </span>
      </Link>

      <div className="mt-4 grid gap-x-10 px-5 sm:px-0 md:grid-cols-[1fr_auto] md:items-end">
        <div className="min-w-0">
          <p className="cap cap-kr text-[12px] text-muted-foreground">
            {cur.name} · {cur.role}
          </p>
          <Link href={cur.href} className="font-display mt-2 block text-[26px] leading-[1.3] break-keep hover:underline hover:underline-offset-4 sm:text-[36px]" data-testid="slider-title">
            {cur.title}
          </Link>
          <p className="cap cap-kr mt-2 text-[12.5px] text-muted-foreground">
            {cur.when} · {cur.place}
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-3 md:mt-0 md:min-w-[260px] md:flex-col md:items-end md:border-t-0 md:pt-0">
          <p className="text-[15px]">
            <b className="font-num font-medium">{cur.price}</b>
            <span className={cn("ml-2 text-[13.5px] font-semibold", cur.closed ? "text-muted-foreground" : "text-brand")} data-testid="slider-seats">
              {cur.seats}
            </span>
          </p>
          <Link href={cur.href} className="inline-flex items-center gap-1.5 text-[14.5px] font-bold text-brand hover:underline" data-testid="slider-cta">
            {cur.sample ? "자세히 보기" : "자리 보기"}
            <ArrowRight aria-hidden className="size-4" strokeWidth={1.6} />
          </Link>
        </div>
      </div>

      {slides.length > 1 && (
        <div className="mt-4 flex gap-1.5 px-5 sm:px-0" data-testid="home-slider-dots">
          {slides.map((s, n) => (
            <button
              key={s.href}
              type="button"
              onClick={() => setI(n)}
              aria-label={`${s.name} 프로그램 보기`}
              aria-current={n === at}
              className={cn("h-[3px] transition-all", n === at ? "w-8 bg-foreground" : "w-4 bg-border hover:bg-muted-foreground")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
