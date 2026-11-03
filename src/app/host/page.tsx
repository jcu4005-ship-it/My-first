import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "호스트" };

// 권한 확인이 끝나기 전에는 응답을 시작하지 않음 → 권한 없으면 HTTP 403
export const instant = false;

export default async function Page() {
  const member = await requireRole("host", "/host");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-8">
        <div data-testid="host-home">
          <h1 className="font-display text-3xl font-bold">호스트 공간</h1>
          <p className="mt-4 text-muted-foreground">
            {member.nickname}님, 모임 개설과 운영 기능은 다음 단계에서 제공됩니다.
          </p>
        </div>
      </main>
    </>
  );
}
