import type { Metadata } from "next";
import { Suspense } from "react";

import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/lib/auth/guards";

import { MfaPanel } from "./mfa-panel";

export const metadata: Metadata = { title: "관리자 2단계 인증" };

// 권한 확인이 끝나기 전에는 응답을 시작하지 않음 → 권한 없으면 HTTP 403
export const instant = false;

export default async function Page() {
  // 관리자 역할 확인 (2단계 인증 전이어도 이 화면은 접근 가능)
  await requireRole("admin", "/admin/mfa");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <h1 className="font-display text-3xl font-bold">2단계 인증</h1>
        <p className="mt-2 text-sm text-muted-foreground">관리자 기능은 인증 앱(OTP) 확인을 마친 뒤에만 사용할 수 있습니다.</p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-muted-foreground">불러오는 중…</p>}>
            <MfaPanel />
          </Suspense>
        </div>
      </main>
    </>
  );
}
