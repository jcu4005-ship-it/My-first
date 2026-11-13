import { useId } from "react";

import { cn } from "@/lib/utils";

/** 그림으로 그리는 최대 의자 수. 정원이 더 크면 비율대로 12개에 나눠 그리고 숫자로 정원을 함께 알려 줌 */
export const MAX_DRAWN_SEATS = 12;

/**
 * 위에서 내려다본 둥근 원목 테이블과 의자 — 사람이 앉은 의자 = 예약된 자리, 빈 의자 = 남은 자리, 도장색 사람 = 내가 고른 인원.
 * 왼쪽 위에서 빛이 들어와 그림자는 오른쪽 아래로. 실제 데이터(정원·예약 수)만 사용.
 * 자리를 지정해 앉는 기능이 아니라 "몇 자리 남았는지"를 보여 주는 그림.
 */
export function SeatTable({
  capacity,
  taken,
  mine = 0,
  closed = false,
  size = "md",
  className,
  center,
  tableR = 22,
  chairR = 38,
  chairSize,
}: {
  /** 테이블 위에 놓을 내용 (지정하면 남은 자리 숫자 대신 표시, 그림 설명은 숨김) */
  center?: React.ReactNode;
  tableR?: number;
  chairR?: number;
  chairSize?: number;
  capacity: number;
  taken: number;
  /** 내가 신청하려는 인원 (상세 화면) */
  mine?: number;
  /** 마감·모집 중지 */
  closed?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const cap = Math.max(1, capacity);
  const reserved = Math.min(cap, Math.max(0, taken));
  const picked = Math.min(cap - reserved, Math.max(0, mine));
  const left = closed ? 0 : cap - reserved - picked;
  const drawn = Math.min(cap, MAX_DRAWN_SEATS);
  const scale = drawn / cap;
  const drawnTaken = closed ? drawn : Math.min(drawn, Math.round(reserved * scale));
  const drawnMine = closed ? 0 : Math.min(drawn - drawnTaken, Math.ceil(picked * scale));
  const label = closed
    ? `정원 ${cap}명, 마감`
    : `정원 ${cap}명 중 ${reserved}명 예약${picked ? `, 내가 고른 ${picked}자리` : ""}, ${left}자리 남음`;

  // 100 x 100 좌표계
  const R = chairR;
  const cw = chairSize ?? (drawn > 10 ? 10.5 : 12.5);
  const chairs = Array.from({ length: drawn }, (_, i) => {
    const a = (i / drawn) * 360 - 90;
    const rad = (a * Math.PI) / 180;
    return { a, x: 50 + R * Math.cos(rad), y: 50 + R * Math.sin(rad), state: i < drawnTaken ? "taken" : i < drawnTaken + drawnMine ? "mine" : "open" };
  });

  return (
    <div {...(center ? { "aria-hidden": true } : { role: "img", "aria-label": label, "data-testid": "seat-table" })} className={cn("relative aspect-square", className)}>
      <svg viewBox="0 0 100 100" overflow="visible" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={`${uid}s`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#EEF2E8" />
            <stop offset="1" stopColor="#C9D4BD" />
          </linearGradient>
          <radialGradient id={`${uid}t`} cx="0.4" cy="0.35" r="0.75">
            <stop offset="0" stopColor="#E9D2B3" />
            <stop offset="0.6" stopColor="#D2AA80" />
            <stop offset="1" stopColor="#B98A5E" />
          </radialGradient>
          <filter id={`${uid}b`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>
        {/* 그림자 (오른쪽 아래) */}
        <g filter={`url(#${uid}b)`} opacity="0.28" fill="#2A3826">
          <circle cx="53" cy="54.5" r={tableR} />
          {chairs.map((c, i) => (
            <rect key={i} x={-cw / 2} y={-cw / 2} width={cw} height={cw * 1.35} rx={cw * 0.15} transform={`translate(${c.x + 2.8} ${c.y + 4}) rotate(${c.a - 90})`} />
          ))}
        </g>
        {/* 의자: 등받이는 바깥, 좌판은 테이블 쪽 */}
        {chairs.map((c, i) => (
          <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.a - 90})`}>
            <rect x={-cw / 2} y={-cw / 2} width={cw} height={cw} rx={cw * 0.12} fill={`url(#${uid}s)`} stroke="#B97E52" strokeWidth="0.8" />
            <path d={`M ${-cw / 2 - 0.4} ${cw / 2 + cw * 0.1} Q 0 ${cw / 2 + cw * 0.4} ${cw / 2 + 0.4} ${cw / 2 + cw * 0.1}`} fill="none" stroke="#B97E52" strokeWidth="2.1" strokeLinecap="round" />
            <path d={`M ${-cw / 2 - 0.4} ${cw / 2 + cw * 0.1} Q 0 ${cw / 2 + cw * 0.4} ${cw / 2 + 0.4} ${cw / 2 + cw * 0.1}`} fill="none" stroke="#C9D5BC" strokeWidth="1.1" strokeLinecap="round" />
            {c.state !== "open" && (
              <g fill={c.state === "mine" ? "#A2412F" : "#2C4232"}>
                <ellipse cx="0" cy={cw * 0.12} rx={cw * 0.42} ry={cw * 0.3} />
                <circle cx="0" cy={-cw * 0.12} r={cw * 0.2} />
              </g>
            )}
          </g>
        ))}
        {/* 원목 테이블 */}
        <circle cx="50" cy="50" r={tableR} fill={`url(#${uid}t)`} stroke="#B37A4D" strokeWidth="1.4" />
        {[0.84, 0.66, 0.48, 0.3].map((k) => (
          <circle key={k} cx={50 + tableR * 0.06} cy={50 + tableR * 0.08} r={tableR * k} fill="none" stroke="rgb(120 78 40 / 0.12)" strokeWidth="0.4" />
        ))}
        <circle cx={50 - tableR * 0.27} cy={50 - tableR * 0.32} r={tableR * 0.42} fill="rgb(255 250 238 / 0.3)" />
      </svg>
      <div aria-hidden={center ? undefined : true} className="absolute inset-[30%] flex flex-col items-center justify-center text-center leading-tight text-[#3b2a1c]">
        {center ? center : closed ? (
          <span className={cn("font-bold", size === "sm" ? "text-xs" : "text-sm")}>마감</span>
        ) : (
          <>
            <span className={cn("font-display font-bold", size === "sm" ? "text-base" : size === "lg" ? "text-3xl" : "text-2xl")}>{left}</span>
            <span className={size === "sm" ? "text-[9px]" : "text-[11px]"}>자리 남음</span>
          </>
        )}
        {cap > MAX_DRAWN_SEATS && <span className="text-[8px] opacity-80">정원 {cap}명</span>}
      </div>
    </div>
  );
}

/** 밀랍 도장 (마지막 자리·심사 통과 등 아주 중요한 표시에만) */
export function Seal({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-11 -rotate-12 items-center justify-center rounded-full bg-clay text-center font-display text-[10px] leading-tight font-bold text-[#f7e9df] shadow-[inset_0_0_0_3px_rgb(255_255_255/0.18)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** 로고 표시: 위에서 본 테이블과 의자 6개 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-block size-6", className)}>
      <span className="absolute inset-[25%] rounded-full bg-forest" />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * 2 * Math.PI - Math.PI / 2;
        return (
          <span
            key={i}
            className="absolute size-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-forest"
            style={{ left: `${50 + 44 * Math.cos(a)}%`, top: `${50 + 44 * Math.sin(a)}%` }}
          />
        );
      })}
    </span>
  );
}
