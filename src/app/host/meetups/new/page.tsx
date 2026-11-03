import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/lib/auth/guards";
import { listCategories } from "@/lib/meetups/queries";

import { MeetupForm } from "../meetup-form";

export const metadata: Metadata = { title: "새 클래스 만들기" };
export const instant = false;

export default async function NewMeetupPage() {
  await requireRole("host", "/host/meetups/new");
  const categories = await listCategories();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="font-display text-3xl font-bold">새 클래스 만들기</h1>
        <p className="mt-2 text-sm text-muted-foreground">저장 → 일정 추가 → 검수 요청 순서로 진행돼요. 승인되면 공개됩니다.</p>
        <div className="mt-8">
          <MeetupForm categories={categories} />
        </div>
      </main>
    </>
  );
}
