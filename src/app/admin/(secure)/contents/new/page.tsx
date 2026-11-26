import type { Metadata } from "next";
import Link from "next/link";

import { ContentForm } from "@/components/contents/content-form";
import { requireAdmin } from "@/lib/auth/guards";
import { contentDefaults, listLinkableMeetups } from "@/lib/contents/queries";
import { listFeaturedHosts } from "@/lib/meetups/queries";

export const metadata: Metadata = { title: "운영팀 글 쓰기" };
export const instant = false;

export default async function AdminNewContentPage() {
  const admin = await requireAdmin("/admin/contents/new");
  const [meetups, hosts] = await Promise.all([listLinkableMeetups(null), listFeaturedHosts(200)]);
  return (
    <div className="max-w-2xl">
      <Link href="/admin/contents" className="text-sm text-muted-foreground">← 콘텐츠 검토</Link>
      <h1 className="mt-4 mb-2 font-display text-3xl font-bold">운영팀 글 쓰기</h1>
      <p className="mb-8 text-sm text-muted-foreground">호스트 인터뷰·큐레이션 글. 저장 후 바로 공개할 수 있어요 (감사 기록이 남아요).</p>
      <ContentForm scope="admin" userId={admin.id} defaults={contentDefaults(null)} meetups={meetups} hosts={hosts} />
    </div>
  );
}
