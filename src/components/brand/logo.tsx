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
