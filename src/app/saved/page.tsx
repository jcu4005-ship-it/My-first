import type { Metadata } from "next";

import { getCurrentMember } from "@/lib/auth/session";

import { SavedList } from "@/components/saved";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "저장한 프로그램" };
export const instant = false;

export default async function SavedPage() {
  const member = await getCurrentMember().catch(() => null);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-8 pb-14 sm:px-6 sm:pt-12">
        <p className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground">SAVED</p>
        <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">저장한 프로그램</h1>
        <p className="mt-1.5 mb-6 text-sm text-muted-foreground" data-testid="saved-scope">
          {member ? "계정에 저장돼요. 로그인한 어느 기기에서나 같은 목록이 보여요." : "지금은 이 기기에만 저장돼요. 로그인하면 계정에 함께 저장돼 다른 기기에서도 보여요."}
        </p>
        <SavedList />
      </main>
      <SiteFooter />
    </>
  );
}
