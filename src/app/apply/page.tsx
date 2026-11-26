import type { Metadata } from "next";

import { Blue } from "@/components/layout/blue";
import { brand } from "@/config/brand";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import { ApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "크리에이터 지원",
  description: "아직 구체적인 프로그램이 없어도 괜찮습니다. 1분이면 지원할 수 있어요.",
};

export default function CreatorApplyPage() {
  return (
    <Blue>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-10 pb-24 sm:px-8 sm:pt-16" data-testid="creator-apply">
        <p className="cap text-[12px] font-semibold text-brand">Become a Creator</p>
        <h1 className="font-display mt-3 text-[34px] leading-[1.25] font-light break-keep sm:text-[48px]">당신의 가능성을 발견합니다.</h1>
        <p className="mt-6 leading-relaxed text-muted-foreground">
          {brand.name}는 자신만의 경험과 관점을 가진 사람을 찾습니다.
          <br />
          <br />
          아직 구체적인 프로그램이 없어도 괜찮습니다. 당신이 가진 가능성을 함께 발견해 보세요.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">작성은 1분이면 끝나요. 입장료는 없어요.</p>
        <div className="mt-12">
          <ApplyForm />
        </div>
      </main>
      <SiteFooter />
    </Blue>
  );
}
