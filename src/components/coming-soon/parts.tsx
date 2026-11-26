import Link from "next/link";

import { LogoSymbol } from "@/components/brand/logo";
import { BusinessInfoBlock } from "@/components/legal/business-info";
import { brand, displayName } from "@/config/brand";

/** 임시 공개 모드 머리글: 이름만. (메뉴·로그인·검색은 열려 있지 않은 화면으로 가므로 두지 않음) */
export function ComingSoonHeader() {
  return (
    <header className="sticky top-0 z-30 bg-background/92 backdrop-blur" data-testid="coming-soon-header">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 text-brand" aria-label={`${displayName()} 홈`} data-testid="site-logo">
          <LogoSymbol className="w-6" />
          <span className="cap text-[12px] font-semibold">{brand.name}</span>
        </Link>
        <span className="cap-kr text-[12px] text-muted-foreground">곧 문을 엽니다</span>
      </div>
    </header>
  );
}

const POLICY_LINKS = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보 처리방침" },
  { href: "/refund", label: "취소·환불 정책" },
];

/** 임시 공개 모드 바닥글: 약관·방침 링크와 사업자 정보 */
export function ComingSoonFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-linen/60" data-testid="coming-soon-footer">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-2">
          <p className="font-display text-xl font-bold text-forest">{displayName({ withPlaceholderMark: true })}</p>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{brand.description}</p>
        </div>
        <nav aria-label="약관과 정책" className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5 text-sm font-semibold" data-testid="footer-policy-links">
          {POLICY_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:underline hover:underline-offset-4">
              {l.label}
            </Link>
          ))}
        </nav>
        <BusinessInfoBlock compact testId="footer-business-info" hideEmpty={["intermediaryNotice"]} />
        <p className="border-t border-border pt-5 text-[13px] leading-relaxed text-muted-foreground">
          서비스 준비 중입니다. 프로그램 신청과 결제는 정식 오픈 후에 시작돼요.
        </p>
      </div>
    </footer>
  );
}
