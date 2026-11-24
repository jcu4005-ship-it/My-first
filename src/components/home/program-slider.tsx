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
 * 홈 맨 위 프로그램 슬라이드 (대표 요청 2026-11-21): 서비스 제호 바로 아래에서 "프로그램"이 주인공으로 2초마다 바뀌고
 * (제목·날짜·장소·참가비·남은 자리), 그 프로그램을 여는 크리에이터 사진이 함께 크게 보입니다.
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
      <div className="grid md:grid-cols-[1.05fr_1fr]">
        {/* 크리에이터 사진 (맨 위) */}
        <Link
          href={cur.hostHref}
          className="group relative block aspect-[4/4.6] overflow-hidden bg-muted md:aspect-auto md:min-h-[420px]"
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
              sizes="(min-width: 768px) 600px, 100vw"
              unoptimized={/^https?:\/\//.test(s.photo)}
              className={cn(
                "object-cover object-[50%_14%] transition-[opacity,transform] duration-700 ease-out group-hover:scale-[1.02]",
                n === at ? "opacity-100" : "opacity-0",
              )}
            />
          ))}
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#252b33]/75 to-transparent px-5 pt-14 pb-4 text-white sm:px-6" aria-hidden>
            <span className="cap cap-kr block text-[11.5px] opacity-85">with</span>
            <span className="font-display mt-0.5 block text-[28px] leading-tight">{cur.name}</span>
            <span className="block text-[13.5px] opacity-90">{cur.role}</span>
          </span>
        </Link>

        {/* 프로그램: 제목·날짜·장소·참가비·남은 자리 (사진 아래) */}
        <div key={at} className="fade-in flex flex-col justify-between bg-soft px-5 py-5 sm:px-9 sm:py-10">
          <p className="cap cap-kr text-[12px] text-brand">
            Program {String(at + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
            {cur.sample && <span className="ml-2 text-muted-foreground">· 샘플</span>}
          </p>
          <Link href={cur.href} className="font-display mt-3 block text-[28px] leading-[1.25] break-keep hover:underline hover:underline-offset-4 sm:text-[46px]" data-testid="slider-title">
            {cur.title}
          </Link>
          <div className="mt-5">
            <p className="cap cap-kr text-[12.5px] text-foreground">
              {cur.when} · {cur.place}
            </p>
            <div className="mt-3 flex items-end justify-between gap-4 border-t border-foreground/25 pt-3">
              <p className="text-[15px]">
                <b className="font-num font-medium">{cur.price}</b>
                <span className={cn("ml-2 text-[13.5px] font-semibold", cur.closed ? "text-muted-foreground" : "text-brand")} data-testid="slider-seats">
                  {cur.seats}
                </span>
              </p>
              <Link href={cur.href} className="inline-flex shrink-0 items-center gap-1.5 text-[14.5px] font-bold text-brand hover:underline" data-testid="slider-cta">
                {cur.sample ? "자세히 보기" : "자리 보기"}
                <ArrowRight aria-hidden className="size-4" strokeWidth={1.6} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {slides.length > 1 && (
        <div className="mt-4 flex gap-1.5 px-5 sm:px-0" data-testid="home-slider-dots">
          {slides.map((s, n) => (
            <button
              key={s.href}
              type="button"
              onClick={() => setI(n)}
              aria-label={`${s.title} 프로그램 보기`}
              aria-current={n === at}
              className={cn("h-[3px] transition-all", n === at ? "w-8 bg-foreground" : "w-4 bg-border hover:bg-muted-foreground")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
