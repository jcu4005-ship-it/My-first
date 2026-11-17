"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type CoverSlide = { href: string; name: string; role: string; photo: string };

const INTERVAL_MS = 2000;

/**
 * 메인 표지 사진: 크리에이터 사진이 2초마다 바뀝니다(서서히 겹쳐 바뀜).
 * - 마우스를 올리거나 키보드로 가리키면 멈춥니다(읽는 중에 바뀌지 않게).
 * - 기기에서 "동작 줄이기"를 켠 사람에게는 자동으로 바꾸지 않습니다. 아래 점을 눌러 넘길 수 있어요.
 * - 사진은 처음부터 모두 겹쳐 두고 투명도만 바꿔서, 바뀔 때 빈 화면이 생기지 않습니다.
 */
export function CoverRotator({ slides }: { slides: CoverSlide[] }) {
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
  const cur = slides[i % slides.length];

  return (
    <div
      className="relative lg:order-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Link
        href={cur.href}
        className="group relative block aspect-[4/5] overflow-hidden rounded-[2px] bg-linen"
        data-testid="cover-story"
        aria-label={`표지 크리에이터 ${cur.name} — ${cur.role}`}
      >
        {slides.map((s, n) => (
          <Image
            key={s.href}
            src={s.photo}
            alt=""
            fill
            priority={n === 0}
            sizes="(min-width: 1024px) 34vw, 100vw"
            unoptimized={/^https?:\/\//.test(s.photo)}
            className={cn(
              "object-cover object-[50%_14%] transition-[opacity,transform] duration-700 ease-out group-hover:scale-[1.02]",
              n === i % slides.length ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pt-14 pb-4 text-white sm:px-5" aria-hidden>
          <span className="block text-[10.5px] font-bold tracking-[0.26em] uppercase opacity-85">Cover story</span>
          <span className="mt-1 block text-[22px] font-extrabold tracking-[-0.02em] sm:text-[26px]">{cur.name}</span>
          <span className="block text-[13px] opacity-90">{cur.role}</span>
        </span>
      </Link>
      {slides.length > 1 && (
        <div className="absolute top-3 right-3 flex gap-1.5" data-testid="cover-dots">
          {slides.map((s, n) => (
            <button
              key={s.href}
              type="button"
              onClick={() => setI(n)}
              aria-label={`${s.name} 표지 보기`}
              aria-current={n === i % slides.length}
              className={cn("h-1.5 rounded-full bg-white transition-all", n === i % slides.length ? "w-5" : "w-1.5 opacity-60")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
