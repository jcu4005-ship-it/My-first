import Link from "next/link";

import { brand, displayName } from "@/config/brand";

export function SiteFooter() {
  return (
    <footer className="section-dark mt-24">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 pt-16 pb-10 sm:grid-cols-[1.4fr_1fr_1fr] sm:px-8">
        <div className="max-w-sm">
          <p className="font-display text-2xl font-bold tracking-[0.12em] uppercase">{displayName({ withPlaceholderMark: true })}</p>
          <p className="mt-4 font-display text-lg leading-snug">{brand.englishTagline}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{brand.description}</p>
        </div>
        <nav className="flex flex-col gap-3 text-sm" aria-label="둘러보기">
          <span className="eyebrow text-muted-foreground">Explore</span>
          <Link href="/meetups" className="hover:underline hover:underline-offset-4">프로그램 둘러보기</Link>
          <Link href="/hosts" className="hover:underline hover:underline-offset-4">호스트</Link>
          <Link href="/journal" className="hover:underline hover:underline-offset-4">저널</Link>
        </nav>
        <nav className="flex flex-col gap-3 text-sm" aria-label="함께하기">
          <span className="eyebrow text-muted-foreground">Join</span>
          <Link href="/become-a-host" className="hover:underline hover:underline-offset-4">호스트 안내·정책</Link>
          <Link href="/signup" className="hover:underline hover:underline-offset-4">회원가입</Link>
        </nav>
      </div>
      <p className="mx-auto w-full max-w-7xl border-t px-4 pt-6 pb-10 text-xs leading-relaxed text-muted-foreground sm:px-8">
        서비스 준비 중입니다. 현재 보이는 프로그램은 &lsquo;샘플&rsquo;로 표시된 예시이며 실제로 신청할 수 없습니다.
        사업자 정보와 통신판매중개 고지는 정식 오픈 전 확정 후 표시됩니다.
      </p>
    </footer>
  );
}
