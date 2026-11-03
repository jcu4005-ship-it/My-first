import { brand, displayName } from "@/config/brand";
import { Button } from "@/components/ui/button";

/**
 * 0단계 임시 홈 — 기반 구조(브랜드 설정·디자인 토큰·글꼴) 확인용입니다.
 * 실제 홈 화면은 3단계(탐색)에서 구현합니다.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-8">
      <header className="flex items-center justify-between py-6">
        <span className="font-display text-xl font-bold tracking-tight">
          {displayName()}
        </span>
        {brand.isPlaceholderName && (
          <span className="text-xs text-muted-foreground">가칭</span>
        )}
      </header>

      <section className="flex flex-1 flex-col justify-center py-16 sm:py-24">
        <p className="mb-6 text-sm tracking-[0.2em] text-accent uppercase">
          Coming soon
        </p>
        <h1 className="font-display text-4xl leading-tight font-bold sm:text-6xl">
          {brand.tagline}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {brand.description}. 지금은 서비스 기반을 준비하고 있습니다.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button disabled aria-disabled>
            모임 둘러보기 (준비 중)
          </Button>
          <Button variant="outline" disabled aria-disabled>
            호스트 지원하기 (준비 중)
          </Button>
        </div>
      </section>

      <footer className="border-t py-8 text-xs leading-relaxed text-muted-foreground">
        <p>
          © {displayName()} · 사업자 정보와 통신판매중개 고지는 출시 전 확정 후
          표시됩니다.
        </p>
      </footer>
    </main>
  );
}
