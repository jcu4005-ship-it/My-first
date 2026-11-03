import Link from "next/link";

import { brand } from "@/config/brand";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

/**
 * 임시 홈 — 실제 홈 화면(모임 탐색)은 3단계에서 구현합니다.
 */
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-8">
        <section className="flex flex-1 flex-col justify-center py-16 sm:py-24">
          <p className="mb-6 text-sm tracking-[0.2em] text-accent uppercase">Coming soon</p>
          <h1 className="font-display text-4xl leading-tight font-bold sm:text-6xl">{brand.tagline}</h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {brand.description}. 지금은 서비스 기반을 준비하고 있습니다.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/signup">먼저 가입하기</Link>
            </Button>
            <Button variant="outline" disabled aria-disabled>
              모임 둘러보기 (준비 중)
            </Button>
          </div>
        </section>
        <footer className="border-t py-8 text-xs leading-relaxed text-muted-foreground">
          <p>사업자 정보와 통신판매중개 고지는 출시 전 확정 후 표시됩니다.</p>
        </footer>
      </main>
    </>
  );
}
