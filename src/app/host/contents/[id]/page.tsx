import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ContentForm, DeleteContentForm } from "@/components/contents/content-form";
import { StatusPill } from "@/components/forms/controls";
import { SiteHeader } from "@/components/site-header";
import { requireActiveMember } from "@/lib/auth/guards";
import { contentDefaults, getMyContent, listLinkableMeetups } from "@/lib/contents/queries";
import { CONTENT_STATUS_LABEL, CONTENT_STATUS_TONE } from "@/lib/contents/types";
import { getMyHostProfile } from "@/lib/hosting/queries";

export const metadata: Metadata = { title: "콘텐츠 편집" };
export const instant = false;

export default async function HostContentPage({ params, searchParams }: PageProps<"/host/contents/[id]">) {
  const { id } = await params;
  const { saved } = await searchParams;
  const member = await requireActiveMember(`/host/contents/${id}`);
  const host = await getMyHostProfile(member.id);
  if (!host || host.status !== "approved" || !member.roles.includes("host")) redirect("/become-a-host/apply");
  const [content, meetups] = await Promise.all([getMyContent(id, member.id), listLinkableMeetups(member.id)]);
  if (!content) notFound();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-8" data-testid="host-content" data-status={content.status}>
        <Link href="/host/contents" className="text-sm text-muted-foreground underline underline-offset-4">← 내 콘텐츠</Link>
        <div className="mt-4 mb-6 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-medium">글 편집</h1>
          <StatusPill tone={CONTENT_STATUS_TONE[content.status]}>{CONTENT_STATUS_LABEL[content.status]}</StatusPill>
        </div>
        {saved && <p className="mb-6 bg-notice px-4 py-3 text-sm text-notice-foreground" role="status">저장했어요. 다 쓰면 검토를 요청해 주세요.</p>}
        {content.status === "published" && (
          <p className="mb-6 text-sm">
            <Link href={`/journal/${content.slug}`} className="underline underline-offset-4" data-testid="view-published">공개된 글 보기</Link>
          </p>
        )}
        {(content.status === "rejected" || content.status === "archived") && content.review_note && (
          <p className="mb-6 bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="content-review-note">
            <strong>운영팀 메모:</strong> {content.review_note}
          </p>
        )}
        <ContentForm scope="host" userId={member.id} contentId={content.id} status={content.status} defaults={contentDefaults(content)} meetups={meetups} />
        {["draft", "rejected", "archived"].includes(content.status) && (
          <div className="mt-12 border-t pt-6">
            <DeleteContentForm contentId={content.id} scope="host" />
          </div>
        )}
      </main>
    </>
  );
}
