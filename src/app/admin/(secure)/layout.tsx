import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

/** 관리자 영역 공통 틀. 권한 확인은 각 화면(page)과 서버 처리, DB에서 각각 수행합니다. */
export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 sm:px-8">
        <nav className="mb-8 flex gap-1 overflow-x-auto border-b text-sm whitespace-nowrap" aria-label="관리자 메뉴">
          <Link href="/admin" className="px-3 py-3 text-muted-foreground hover:text-foreground">대시보드</Link>
          <Link href="/admin/meetups" className="px-3 py-3 text-muted-foreground hover:text-foreground">프로그램 심사</Link>
          <Link href="/admin/hosts" className="px-3 py-3 text-muted-foreground hover:text-foreground">호스트 심사</Link>
          <Link href="/admin/members" className="px-3 py-3 text-muted-foreground hover:text-foreground">회원</Link>
          <Link href="/admin/audit" className="px-3 py-3 text-muted-foreground hover:text-foreground">감사 기록</Link>
        </nav>
        {children}
      </div>
    </>
  );
}
