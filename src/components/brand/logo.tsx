import { displayName } from "@/config/brand";
import { cn } from "@/lib/utils";

import { SYMBOL, WORDMARK } from "./logo-paths";

type Shape = { viewBox: string; transform: string; paths: string[] };

function Svg({ shape, className, title }: { shape: Shape; className?: string; title?: string }) {
  return (
    <svg
      viewBox={shape.viewBox}
      className={cn("block h-auto fill-current", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <g transform={shape.transform}>
        {shape.paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

/** 둥글게 놓인 의자 여섯 개 (로고 심볼) */
export function LogoSymbol({ className }: { className?: string }) {
  return <Svg shape={SYMBOL} className={className} />;
}

/** 머리글용 가로 로고: 심볼 + 이름 글자 */
export function LogoInline({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoSymbol className="w-[22px]" />
      <Svg shape={WORDMARK} className="w-[92px]" title={displayName()} />
    </span>
  );
}

/** 메인 첫 화면용 큰 로고: 심볼 → 이름 글자 */
export function LogoStacked({ className }: { className?: string }) {
  return (
    <span className={cn("flex flex-col items-center", className)}>
      <LogoSymbol className="w-[34%]" />
      <Svg shape={WORDMARK} className="mt-[9%] w-full" title={displayName()} />
    </span>
  );
}

/*
 * 제호 안의 의자: 이름 글자의 "O"(WORDMARK 첫 번째 선) 자리에 의자 심볼을 넣습니다.
 * 숫자는 두 선의 실제 테두리(브라우저 getBBox로 잰 값, 화면 단위)입니다.
 *  - O: x 541~914, y 9~384  → 가운데 x 727.5, 높이 375
 *  - 심볼: x 24~1138, y 19~1223 (1114 × 1204)
 */
const O_BOX = { cx: 727.5, top: 9, h: 375 };
const SYM_BOX = { x: 24, y: 19, w: 1114, h: 1204 };
const SYM_SCALE = O_BOX.h / SYM_BOX.h;

/** 큰 제호 — "O" 대신 둥글게 놓인 의자 */
export function LogoWordmarkChair({ className }: { className?: string }) {
  const tx = O_BOX.cx - (SYM_BOX.w * SYM_SCALE) / 2 - SYM_BOX.x * SYM_SCALE;
  const ty = O_BOX.top - SYM_BOX.y * SYM_SCALE;
  return (
    <svg
      viewBox={WORDMARK.viewBox}
      className={cn("block h-auto fill-current", className)}
      role="img"
      aria-label={displayName()}
      focusable="false"
      data-testid="wordmark-chair"
    >
      <g transform={WORDMARK.transform}>
        {WORDMARK.paths.slice(1).map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g transform={`translate(${tx} ${ty}) scale(${SYM_SCALE})`}>
        <g transform={SYMBOL.transform}>
          {SYMBOL.paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </g>
    </svg>
  );
}

/** 큰 제호(잡지 이름처럼): 메인 첫 화면 맨 위 */
export function LogoWordmark({ className }: { className?: string }) {
  return <Svg shape={WORDMARK} className={className} title={displayName()} />;
}
