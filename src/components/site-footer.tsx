import Link from "next/link";

import { brand, displayName } from "@/config/brand";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 text-sm sm:flex-row sm:justify-between sm:px-8">
        <div className="max-w-sm">
          <p className="font-display text-lg font-bold">{displayName({ withPlaceholderMark: true })}</p>
          <p className="mt-2 text-muted-foreground">{brand.description}</p>
        </div>
        <nav className="flex gap-6 text-muted-foreground" aria-label="바로가기">
          <Link href="/meetups" className="hover:text-foreground">모임 둘러보기</Link>
          <Link href="/signup" className="hover:text-foreground">회원가입</Link>
        </nav>
      </div>
      <p className="mx-auto w-full max-w-6xl px-4 pb-10 text-xs leading-relaxed text-muted-foreground sm:px-8">
        서비스 준비 중입니다. 현재 보이는 모임은 &lsquo;샘플&rsquo;로 표시된 예시이며 실제로 신청할 수 없습니다.
        사업자 정보와 통신판매중개 고지는 정식 오픈 전 확정 후 표시됩니다.
      </p>
    </footer>
  );
}
