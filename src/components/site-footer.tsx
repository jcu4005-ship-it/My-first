import Link from "next/link";

import { brand, displayName } from "@/config/brand";

const LINKS = [
  { href: "/meetups", label: "프로그램" },
  { href: "/hosts", label: "호스트" },
  { href: "/journal", label: "저널" },
  { href: "/become-a-host", label: "호스트 안내·정책" },
  { href: "/signup", label: "회원가입" },
  { href: "/help", label: "고객센터" },
  { href: "/privacy", label: "개인정보 처리방침" },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-linen/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-2">
          <p className="font-display text-xl font-bold text-forest">{displayName({ withPlaceholderMark: true })}</p>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{brand.description}</p>
        </div>
        <nav aria-label="사이트 안내" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-foreground/80 hover:text-foreground hover:underline hover:underline-offset-4">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
          서비스 준비 중입니다. 현재 보이는 프로그램은 &lsquo;샘플&rsquo;로 표시된 예시이며 실제로 신청할 수 없습니다.
          사업자 정보와 통신판매중개 고지는 정식 오픈 전 확정 후 표시됩니다.
        </p>
      </div>
    </footer>
  );
}
