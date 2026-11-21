"use client";

import { useId } from "react";

import { SYMBOL } from "@/components/brand/logo-paths";
import { Photo } from "@/components/media/photo";
import { cn } from "@/lib/utils";

/** 그림으로 그리는 최대 의자 수. 정원이 더 크면 비율대로 줄여 그리고, 정확한 숫자는 글자로 알려 줌 */
const MAX_DRAWN = 12;

/** 모닥불 원 색 (블루 시스템): Deep Blue(밝은 바탕에서)·하늘빛(Deep Blue 위에서) = 먼저 앉은 사람, 골드 = 당신 자리, 옅은 파랑 = 빈 자리·열리기 전. 실제 색은 globals.css 의 --seat-* 토큰 */
export const SEAT_COLORS = { lit: "var(--seat-lit)", you: "var(--seat-you)", dim: "var(--seat-dim)" } as const;

// 로고 심볼의 아래쪽 의자(7번째 선)를 의자 한 개로 쓰고, 고리 중심(581,621)을 기준으로 돌려 배치 (ChairRing과 같은 좌표)
const CHAIR = SYMBOL.paths[6];
const CX = 581;
const CY = 621;
const VIEW = { x: -60, y: -60, w: 1296, h: 1392 };

type SeatState = "lit" | "you" | "dim";

/**
 * 모닥불 원: 가운데 크리에이터 얼굴, 둘러앉은 로고 의자.
 * - closed: 아직 열리기 전 → 의자 모두 어둡게
 * - you="open": 첫 빈 의자를 "당신 자리"로 빛나게 (신청 전)
 * - you="mine": 내 자리(이미 앉음)를 빛나게 — taken에 나도 포함
 * 숫자는 항상 실제 정원·예약 수만 씀. 점·사람 모양 그래픽은 쓰지 않음(대표 요청).
 */
export function SeatCircle({
  capacity,
  taken,
  you = false,
  closed = false,
  face,
  initial,
  label,
  className,
  decorative = false,
}: {
  capacity: number;
  taken: number;
  you?: "open" | "mine" | false;
  closed?: boolean;
  face?: string | null;
  initial?: string;
  /** 빛나는 의자 옆 글자 (예: "당신 자리") */
  label?: string;
  className?: string;
  /** 같은 정보를 글자로 이미 알려 주면 true (화면 읽기 프로그램에 두 번 읽히지 않게) */
  decorative?: boolean;
}) {
  const glowId = useId().replace(/:/g, "");
  const cap = Math.max(1, capacity);
  const reserved = Math.min(cap, Math.max(0, taken));
  const drawn = Math.min(cap, MAX_DRAWN);
  const ratio = drawn / cap;
  const drawnTaken = Math.min(drawn, Math.round(reserved * ratio));
  const full = reserved >= cap;

  const states: SeatState[] = Array.from({ length: drawn }, (_, i) => {
    if (closed) return "dim";
    if (you === "mine") return i < drawnTaken - 1 ? "lit" : i === Math.max(0, drawnTaken - 1) ? "you" : "dim";
    if (i < drawnTaken) return "lit";
    if (you === "open" && !full && i === drawnTaken) return "you";
    return "dim";
  });
  const youIndex = states.indexOf("you");
  const sc = Math.min(1, 6.4 / drawn);

  // 라벨 위치: 빛나는 의자 방향으로 원 바깥쪽
  const labelPos = (() => {
    if (!label || youIndex < 0) return null;
    const a = ((180 + (360 * youIndex) / drawn) * Math.PI) / 180;
    const r = 540;
    const x = CX - r * Math.sin(a);
    const y = CY + r * Math.cos(a);
    return { left: `${((x - VIEW.x) / VIEW.w) * 100}%`, top: `${((y - VIEW.y) / VIEW.h) * 100}%` };
  })();

  const left = cap - reserved;
  const aria = closed
    ? `정원 ${cap}명, 아직 열리기 전`
    : you === "mine"
      ? `정원 ${cap}명 중 ${reserved}명, 내 자리 포함`
      : full
        ? `정원 ${cap}명, 가득 찼어요`
        : `정원 ${cap}명 중 ${reserved}명이 먼저 앉았어요, ${left}자리 남음`;

  const faceSize = 47; // 원 지름 대비 %
  return (
    <div
      className={cn("relative aspect-[1296/1392] w-full", className)}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": aria, "data-testid": "seat-table" })}
    >
      <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="absolute inset-0 size-full overflow-visible">
        <defs>
          <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="28" result="b" />
            <feFlood floodColor="#193b63" floodOpacity="0.6" />
            <feComposite in2="b" operator="in" result="c" />
            <feMerge>
              <feMergeNode in="c" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {states.map((state, i) => (
          <g
            key={i}
            transform={`rotate(${180 + (360 * i) / drawn} ${CX} ${CY}) translate(${582 * (1 - sc)} ${1090 * (1 - sc)}) scale(${sc})`}
            data-seat={state === "lit" ? "taken" : state === "you" ? "mine" : "open"}
            filter={state === "you" ? `url(#${glowId})` : undefined}
            className={state === "you" ? "seat-glow" : undefined}
          >
            <g transform={SYMBOL.transform}>
              <path d={CHAIR} style={{ fill: SEAT_COLORS[state] }} />
            </g>
          </g>
        ))}
      </svg>
      <div
        className="@container absolute overflow-hidden rounded-full bg-muted shadow-[0_0_0_4px_var(--card),0_0_0_5px_var(--border),0_16px_40px_-16px_rgb(20_24_28/0.35)]"
        style={{
          width: `${faceSize}%`,
          height: `${(faceSize * VIEW.w) / VIEW.h}%`,
          left: `${((CX - VIEW.x) / VIEW.w) * 100 - faceSize / 2}%`,
          top: `${((CY - VIEW.y) / VIEW.h) * 100 - (faceSize * VIEW.w) / VIEW.h / 2}%`,
        }}
      >
        <Photo
          src={face}
          alt=""
          sizes="240px"
          className="object-[center_18%]"
          fallback={
            <span aria-hidden className="flex size-full items-center justify-center bg-muted font-display text-[clamp(14px,30cqw,64px)] font-bold text-forest">
              {initial}
            </span>
          }
        />
      </div>
      {labelPos && (
        <span
          aria-hidden
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold px-2.5 py-1 text-[12px] font-black whitespace-nowrap text-gold-ink shadow-[0_6px_20px_-4px_rgb(25_59_99/0.45)]"
          style={labelPos}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/** 색 안내 */
export function SeatLegend({ closed = false, className }: { closed?: boolean; className?: string }) {
  const item = (color: string, text: string, glow = false) => (
    <span className="flex items-center gap-1.5">
      <i aria-hidden className="size-3 rounded-[3px]" style={{ background: color, boxShadow: glow ? "0 0 6px #193b63" : undefined }} />
      {text}
    </span>
  );
  return (
    <span className={cn("flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground", className)}>
      {item(SEAT_COLORS.lit, "먼저 앉은 사람")}
      {item(SEAT_COLORS.you, "당신 자리", true)}
      {item(SEAT_COLORS.dim, closed ? "열리기 전" : "빈 자리")}
    </span>
  );
}
