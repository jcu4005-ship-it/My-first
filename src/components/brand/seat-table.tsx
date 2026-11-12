import { cn } from "@/lib/utils";

/** 그림으로 그리는 최대 의자 수. 정원이 더 크면 비율대로 12개에 나눠 그리고 숫자로 정원을 함께 알려 줌 */
export const MAX_DRAWN_SEATS = 12;

/**
 * 위에서 내려다본 둥근 테이블 — 진한 의자 = 예약된 자리, 점선 의자 = 빈자리, 도장색 의자 = 내가 고른 자리.
 * 실제 데이터(정원·예약 수)만 사용. 자리를 지정해 앉는 기능이 아니라 "몇 자리 남았는지"를 보여 주는 그림.
 */
export function SeatTable({
  capacity,
  taken,
  mine = 0,
  closed = false,
  size = "md",
  className,
}: {
  capacity: number;
  taken: number;
  /** 내가 신청하려는 인원 (상세 화면) */
  mine?: number;
  /** 마감·모집 중지 */
  closed?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
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

  return (
    <div role="img" aria-label={label} className={cn("relative aspect-square", className)} data-testid="seat-table">
      {Array.from({ length: drawn }, (_, i) => {
        const a = (i / drawn) * 2 * Math.PI - Math.PI / 2;
        const state = i < drawnTaken ? "taken" : i < drawnTaken + drawnMine ? "mine" : "open";
        return (
          <span
            key={i}
            aria-hidden
            className={cn(
              "absolute size-[15%] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors",
              state === "taken" && "bg-forest",
              state === "mine" && "bg-clay shadow-[0_0_0_3px_rgb(162_65_47/0.2)]",
              state === "open" && "border-2 border-dashed border-sage bg-card",
            )}
            style={{ left: `${50 + 40 * Math.cos(a)}%`, top: `${50 + 40 * Math.sin(a)}%` }}
          />
        );
      })}
      <div aria-hidden className="absolute inset-[23%] flex flex-col items-center justify-center rounded-full bg-forest text-center leading-tight text-[#dce9df]">
        {closed ? (
          <span className={cn("font-bold text-white", size === "sm" ? "text-sm" : "text-base")}>마감</span>
        ) : (
          <>
            <span className={cn("font-extrabold text-white", size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl")}>{left}</span>
            <span className={size === "sm" ? "text-[10px]" : "text-xs"}>자리 남음</span>
          </>
        )}
        {cap > MAX_DRAWN_SEATS && <span className="mt-0.5 text-[9px] opacity-80">정원 {cap}명</span>}
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
