"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Photo } from "@/components/media/photo";
import { cn } from "@/lib/utils";

import { EditorialCover } from "./editorial-cover";

export type GalleryItem = {
  id: string;
  title: string;
  summary: string;
  categorySlug: string;
  categoryLabel: string;
  categoryName: string;
  area: string;
  coverUrl: string | null;
  isSample: boolean;
};

/** 화면 너비에 따른 배치 값 (작품 간격·깊이·각도) */
function layoutFor(width: number) {
  // 휴대폰: 가운데 작품을 크게, 양옆 작품은 가장자리에 살짝 보여 "넘길 수 있다"는 걸 알려 줌
  if (width < 640) return { gap: width * 0.56, depth: 200, angle: 44, scaleStep: 0.12, base: Math.min(width * 0.6, 250) };
  if (width < 1024) return { gap: Math.min(width * 0.32, 290), depth: 280, angle: 48, scaleStep: 0.1, base: 280 };
  return { gap: Math.min(width * 0.25, 330), depth: 320, angle: 50, scaleStep: 0.09, base: 300 };
}

/**
 * 전시장처럼 보이도록 작품마다 크기·비율을 조금씩 다르게 (같은 순서면 항상 같은 모양).
 * 모든 작품은 눈높이(가운데 선)에 맞춰 걸립니다.
 */
const FRAMES = [
  { w: 1, aspect: "4 / 5" },
  { w: 0.86, aspect: "1 / 1" },
  { w: 0.94, aspect: "3 / 4" },
  { w: 1.08, aspect: "5 / 4" },
  { w: 0.8, aspect: "2 / 3" },
  { w: 0.92, aspect: "4 / 5" },
];

const EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";
const DURATION = 900; // ms — 천천히, 과장 없이

/**
 * 미술관 벽에 사선으로 걸린 작품처럼 클래스를 보여 주는 갤러리.
 * - 작품 클릭 / 좌우 버튼 / 키보드 ←→ / 마우스 드래그 / 터치 스와이프로 이동
 * - 가운데 작품은 정면·확대·선명, 나머지는 각도를 두고 뒤로 물러남
 */
export function ExhibitionGallery({ items }: { items: GalleryItem[] }) {
  const [active, setActive] = useState(Math.floor((items.length - 1) / 2));
  const [width, setWidth] = useState(1280);
  const [dragX, setDragX] = useState(0);
  const [touched, setTouched] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startT: number; moved: boolean; pointerId: number } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const go = useCallback(
    (i: number) => {
      setTouched(true);
      setActive(Math.max(0, Math.min(items.length - 1, i)));
    },
    [items.length],
  );

  if (!items.length) return null;
  const { gap, depth, angle, scaleStep, base } = layoutFor(width);
  const current = items[active];
  // 드래그 중에는 손가락을 따라 살짝 움직임 (작품 1칸 = gap px)
  const dragOffset = dragX / gap;

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { startX: e.clientX, startT: performance.now(), moved: false, pointerId: e.pointerId };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(d.pointerId);
    }
    if (d.moved) setDragX(dx);
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      suppressClick.current = true;
      const dx = e.clientX - d.startX;
      const fast = performance.now() - d.startT < 300 && Math.abs(dx) > 30; // 짧고 빠르게 튕기기
      const steps = Math.round(-dx / gap);
      go(active + (steps === 0 && (fast || Math.abs(dx) > 50) ? (dx < 0 ? 1 : -1) : steps));
    }
    setDragX(0);
  }

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label="클래스 갤러리"
      data-testid="exhibition-gallery"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); go(active + 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(active - 1); }
      }}
    >
      {/* 전시 벽 */}
      <div
        ref={stageRef}
        className="relative h-[23rem] touch-pan-y overflow-hidden select-none sm:h-[32rem]"
        style={{ perspective: "1600px", cursor: dragX ? "grabbing" : "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* 바닥선과 조명 */}
        {/* 눈높이 선 (작품이 걸린 기준선) */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[46%] h-px bg-sand-light/[0.06]" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 45% 60% at 50% 38%, rgba(245,241,234,0.07), transparent 70%)" }}
        />
        {/* ul은 클릭을 받지 않게: 뒤로 물러난(z<0) 작품도 클릭되도록 */}
        <ul className="pointer-events-none absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
          {items.map((item, i) => {
            const offset = i - active + dragOffset;
            const abs = Math.abs(offset);
            const hidden = abs > 3.5;
            const side = Math.sign(offset);
            // 가운데에서 멀수록: 옆으로·뒤로·작게·어둡게, 그리고 벽을 따라 사선으로 회전
            const x = offset * gap + side * Math.max(0, abs - 1) * -gap * 0.28;
            const z = -Math.min(abs, 3) * depth;
            const rot = -side * Math.min(abs, 1) * angle;
            const scale = 1 - Math.min(abs, 3) * scaleStep;
            const isActive = i === active;
            const frame = FRAMES[i % FRAMES.length];
            const w = Math.round(base * frame.w);
            return (
              <li
                key={item.id}
                className="absolute top-[46%] left-1/2"
                style={{
                  width: w,
                  transform: `translate3d(calc(${x}px - 50%), -50%, ${z}px) rotateY(${rot}deg) scale(${scale})`,
                  transition: dragX ? "none" : `transform ${DURATION}ms ${EASE}, filter ${DURATION}ms ${EASE}, opacity ${DURATION}ms ${EASE}`,
                  zIndex: 100 - Math.round(abs * 10),
                  filter: isActive && !dragX ? "none" : `brightness(${1 - Math.min(abs, 3) * 0.17}) saturate(${1 - Math.min(abs, 3) * 0.2})`,
                  opacity: hidden ? 0 : 1,
                  pointerEvents: hidden ? "none" : "auto",
                }}
                aria-hidden={hidden || undefined}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (suppressClick.current) { suppressClick.current = false; return; }
                    go(i);
                  }}
                  className="group relative block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-sand-light focus-visible:ring-offset-4 focus-visible:ring-offset-espresso"
                  aria-label={`${item.categoryName} · ${item.title}${isActive ? " (선택됨)" : ""}`}
                  aria-current={isActive ? "true" : undefined}
                  data-testid="gallery-item"
                  data-active={isActive ? "true" : "false"}
                  tabIndex={hidden ? -1 : 0}
                  draggable={false}
                >
                  {/* 액자: 얇은 프레임 + 매트(여백) */}
                  <span
                    className="block bg-sand-light p-3 sm:p-4"
                    style={{ boxShadow: isActive ? "0 40px 60px -30px rgba(0,0,0,0.75)" : "0 24px 40px -28px rgba(0,0,0,0.7)" }}
                  >
                    <span className="relative block overflow-hidden bg-espresso" style={{ aspectRatio: frame.aspect }}>
                      <Photo
                        src={item.coverUrl}
                        alt=""
                        sizes="300px"
                        fallback={<EditorialCover category={item.categorySlug} title={item.title} showTitle={false} />}
                      />
                    </span>
                  </span>
                  {/* 작품 캡션 (벽에 붙은 작은 명판) */}
                  <span
                    className="absolute inset-x-0 top-full mt-4 block text-center transition-opacity"
                    style={{ opacity: isActive ? 0 : Math.max(0, 0.8 - abs * 0.25), transitionDuration: `${DURATION}ms` }}
                  >
                    <span className="eyebrow text-sand/80">{item.categoryLabel}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 가운데 작품 설명 (전시 명판) */}
      {/* 진행 표시 (눌러서 이동 가능) + 휴대폰 스와이프 안내 */}
      <div className="mx-auto flex max-w-xs items-center gap-1.5 px-4" role="tablist" aria-label="작품 위치">
        {items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`${i + 1}번째 작품: ${it.categoryName}`}
            onClick={() => go(i)}
            className="group flex h-6 flex-1 items-center"
          >
            <span
              className={cn("block h-px w-full transition-colors duration-700", i === active ? "bg-sand-light" : "bg-sand-light/25 group-hover:bg-sand-light/50")}
            />
          </button>
        ))}
      </div>
      <p
        aria-hidden
        className={cn("mt-1 text-center text-[11px] tracking-[0.2em] text-muted-foreground transition-opacity duration-700 sm:hidden", touched && "opacity-0")}
      >
        ← 밀어서 둘러보기 →
      </p>

      <div className="mx-auto mt-4 flex max-w-xl flex-col items-center px-5 text-center sm:mt-6" aria-live="polite" data-testid="gallery-caption">
        <p className="eyebrow text-muted-foreground">
          {String(active + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")} — {current.categoryLabel}
        </p>
        <h3 key={current.id} className="mt-3 font-display text-[1.65rem] leading-snug font-medium break-keep animate-in fade-in duration-700 sm:mt-4 sm:text-3xl">
          {current.title}
        </h3>
        <p key={`${current.id}-s`} className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground animate-in fade-in duration-700">
          {current.summary}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {current.categoryName} · {current.area}
          {current.isSample && " · 샘플"}
        </p>
        <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:mt-7 sm:flex sm:w-auto sm:flex-wrap sm:justify-center sm:gap-3">
          <Link
            href={`/meetups/${current.id}`}
            className="inline-flex h-12 items-center justify-center bg-sand-light px-7 text-sm font-medium tracking-wide text-espresso transition-colors hover:bg-white"
            data-testid="gallery-detail"
          >
            상세 보기
          </Link>
          <Link
            href={`/meetups?category=${current.categorySlug}`}
            className="inline-flex h-12 items-center justify-center border border-sand-light/40 px-6 text-sm tracking-wide transition-colors hover:border-sand-light"
          >
            {current.categoryName} 클래스 더 보기
          </Link>
        </div>
      </div>

      {/* 좌우 버튼: 휴대폰에서는 스와이프로 충분하므로 숨김 */}
      <div className="pointer-events-none absolute inset-x-0 top-[14.7rem] hidden justify-between px-6 sm:flex">
        <GalleryArrow dir="prev" disabled={active === 0} onClick={() => go(active - 1)} />
        <GalleryArrow dir="next" disabled={active === items.length - 1} onClick={() => go(active + 1)} />
      </div>
    </div>
  );
}

function GalleryArrow({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "이전 작품" : "다음 작품"}
      data-testid={`gallery-${dir}`}
      className={cn(
        "pointer-events-auto flex size-11 items-center justify-center border border-sand-light/30 bg-espresso/60 text-sand-light backdrop-blur-sm transition-opacity hover:border-sand-light disabled:opacity-0",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        {dir === "prev" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
      </svg>
    </button>
  );
}
