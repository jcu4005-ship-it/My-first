import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 화면 공통 조각 — 모든 공개 화면이 같은 리듬(여백·제목 크기·색)을 쓰도록.
 * PageHero: 화면 맨 위 제목 / Section: 본문 묶음 / SectionTitle: 묶음 제목(+전체 보기)
 */
export function PageHero({
  title,
  description,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden", className)}>
      <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 size-[26rem] rounded-full bg-mint/30 blur-3xl" />
      <div className="relative mx-auto w-full max-w-6xl px-4 pt-10 pb-8 sm:px-6 sm:pt-16 sm:pb-10">
        <h1 className="max-w-3xl font-display text-3xl leading-tight font-bold break-keep text-forest sm:text-5xl">{title}</h1>
        {description && <div className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">{description}</div>}
        {children}
      </div>
    </section>
  );
}

export function Section({ children, className, ...rest }: React.ComponentProps<"section">) {
  return (
    <section className={cn("mx-auto mt-12 w-full max-w-6xl px-4 sm:mt-16 sm:px-6", className)} {...rest}>
      {children}
    </section>
  );
}

export function SectionTitle({
  id,
  children,
  href,
  linkLabel = "전체 보기",
  description,
}: {
  id?: string;
  children: React.ReactNode;
  href?: string;
  linkLabel?: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="mb-5 sm:mb-6">
      <div className="flex items-end justify-between gap-4">
        <h2 id={id} className="font-display text-2xl font-bold break-keep text-forest sm:text-[1.75rem]">
          {children}
        </h2>
        {href && (
          <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            {linkLabel}
            <ArrowRight aria-hidden className="size-4" strokeWidth={1.6} />
          </Link>
        )}
      </div>
      {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}

/** 둥근 카드 상자 */
export function Card({ className, ...rest }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-border/70 bg-card p-5 sm:p-6", className)} {...rest} />;
}
