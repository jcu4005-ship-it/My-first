import { SYMBOL } from "@/components/brand/logo-paths";
import { cn } from "@/lib/utils";

/** 그림으로 그리는 최대 의자 수. 정원이 더 크면 비율대로 나눠 그리고 글자로 정확한 숫자를 함께 알려 줌 */
const MAX_DRAWN = 12;

export const CHAIR_COLORS = { open: "#d2522b", taken: "#e2ddd3", mine: "#1c3326" } as const;

// 로고 심볼의 아래쪽 의자(7번째 선)를 의자 한 개로 쓰고, 고리 중심(581,621)을 기준으로 돌려 배치
const CHAIR = SYMBOL.paths[6];
const CX = 581;
const CY = 621;

/**
 * 로고 의자로 그린 자리 고리 — 남은 자리 = 주황 의자, 찬 자리 = 연한 회색 의자, 내가 고른 자리 = 짙은 초록.
 * 점·사람 모양은 쓰지 않음(대표 요청). 실제 정원·예약 수만 사용.
 */
export function ChairRing({
  capacity,
  taken,
  mine = 0,
  closed = false,
  className,
  decorative = false,
}: {
  capacity: number;
  taken: number;
  mine?: number;
  closed?: boolean;
  className?: string;
  /** 같은 정보를 다른 곳에서 글자로 이미 알려 주면 true (화면 읽기 프로그램에 두 번 읽히지 않게) */
  decorative?: boolean;
}) {
  const cap = Math.max(1, capacity);
  const reserved = Math.min(cap, Math.max(0, taken));
  const picked = Math.min(cap - reserved, Math.max(0, mine));
  const left = closed ? 0 : cap - reserved - picked;
  const drawn = Math.min(cap, MAX_DRAWN);
  const ratio = drawn / cap;
  const drawnTaken = closed ? drawn : Math.min(drawn, Math.round(reserved * ratio));
  const drawnMine = closed ? 0 : Math.min(drawn - drawnTaken, Math.ceil(picked * ratio));
  const sc = Math.min(1, 6.4 / drawn);
  const label = closed ? `정원 ${cap}명, 마감` : `정원 ${cap}명 중 ${reserved}명 예약${picked ? `, 내가 고른 ${picked}자리` : ""}, ${left}자리 남음`;

  return (
    <svg
      viewBox="-60 -60 1296 1392"
      className={cn("block h-auto", className)}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label, "data-testid": "seat-table" })}
    >
      {Array.from({ length: drawn }, (_, i) => {
        const state = i < drawnTaken ? "taken" : i < drawnTaken + drawnMine ? "mine" : "open";
        const angle = 180 + (360 * i) / drawn;
        return (
          <g key={i} transform={`rotate(${angle} ${CX} ${CY}) translate(${582 * (1 - sc)} ${1090 * (1 - sc)}) scale(${sc})`} data-seat={state}>
            <g transform={SYMBOL.transform}>
              <path d={CHAIR} fill={CHAIR_COLORS[state]} />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/** 색 안내 (남은 자리 · 찬 자리 · 내 자리) */
export function ChairLegend({ mine = false, className }: { mine?: boolean; className?: string }) {
  const item = (color: string, text: string) => (
    <span className="flex items-center gap-1.5">
      <i aria-hidden className="size-3 rounded-[3px]" style={{ background: color }} />
      {text}
    </span>
  );
  return (
    <span className={cn("flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-foreground/75", className)}>
      {item(CHAIR_COLORS.open, "남은 자리")}
      {item(CHAIR_COLORS.taken, "찬 자리")}
      {mine && item(CHAIR_COLORS.mine, "내가 고른 자리")}
    </span>
  );
}
