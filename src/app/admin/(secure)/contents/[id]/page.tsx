import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentForm, DeleteContentForm } from "@/components/contents/content-form";
import { ActionForm } from "@/components/forms/action-form";
import { StatusPill } from "@/components/forms/controls";
import { requireAdmin } from "@/lib/auth/guards";
import { reviewContentAction } from "@/lib/contents/actions";
import { contentDefaults, getContentForAdmin, listLinkableMeetups } from "@/lib/contents/queries";
import { CONTENT_STATUS_LABEL, CONTENT_STATUS_TONE, contentCoverUrl, contentTypeInfo } from "@/lib/contents/types";
import { listFeaturedHosts } from "@/lib/meetups/queries";

export const metadata: Metadata = { title: "콘텐츠 상세" };
export const instant = false;

export default async function AdminContentPage({ params, searchParams }: PageProps<"/admin/contents/[id]">) {
  const { id } = await params;
  const { saved } = await searchParams;
  const admin = await requireAdmin(`/admin/contents/${id}`);
  const c = await getContentForAdmin(id);
  if (!c) notFound();
  const mine = c.author_id === admin.id;
  const [meetups, hosts] = mine ? await Promise.all([listLinkableMeetups(null), listFeaturedHosts(200)]) : [[], []];
  const cover = contentCoverUrl(c.cover_path);

  return (
    <div className="max-w-3xl" data-testid="content-detail" data-status={c.status}>
      <Link href="/admin/contents" className="text-sm text-muted-foreground">← 콘텐츠 검토</Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">{c.title}</h1>
        <StatusPill tone={CONTENT_STATUS_TONE[c.status]}>{CONTENT_STATUS_LABEL[c.status]}</StatusPill>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {contentTypeInfo(c.type)?.ko} · {c.host?.display_name ?? "운영팀"} · 작성 {c.author?.nickname ?? "-"}
        {c.status === "published" && (
          <> · <Link href={`/journal/${c.slug}`} className="underline underline-offset-4">공개 페이지</Link></>
        )}
      </p>
      {saved && <p className="mt-4 bg-notice px-4 py-3 text-sm text-notice-foreground" role="status">저장했어요.</p>}
      {c.review_note && <p className="mt-4 bg-notice px-4 py-3 text-sm text-notice-foreground">최근 메모: {c.review_note}</p>}

      <section className="mt-8 flex flex-col gap-5 border p-5" data-testid="content-review">
        <p className="font-semibold">처리</p>
        {c.status === "submitted" && (
          <>
            <ActionForm action={reviewContentAction} hidden={{ contentId: c.id, action: "publish", note: "" }} label="공개" variant="default" testId="publish-content" />
            <ActionForm action={reviewContentAction} hidden={{ contentId: c.id, action: "reject" }} label="보완 요청"
              note={{ name: "note", placeholder: "보완 요청 내용 (5자 이상, 작성자에게 보여요)" }} testId="reject-content" />
          </>
        )}
        {c.status === "published" && (
          <ActionForm action={reviewContentAction} hidden={{ contentId: c.id, action: "unpublish" }} label="비공개로 내리기"
            note={{ name: "note", placeholder: "내리는 사유 (5자 이상, 작성자에게 보여요)" }} testId="unpublish-content" />
        )}
        {c.status !== "submitted" && c.status !== "published" && !mine && (
          <p className="text-sm text-muted-foreground">작성자가 검토를 요청하면 공개할 수 있어요.</p>
        )}
      </section>

      {mine ? (
        <section className="mt-10">
          <h2 className="mb-6 text-lg font-semibold">편집</h2>
          <ContentForm scope="admin" userId={admin.id} contentId={c.id} status={c.status} defaults={contentDefaults(c)} meetups={meetups} hosts={hosts} />
          {["draft", "rejected", "archived"].includes(c.status) && (
            <div className="mt-10 border-t pt-6"><DeleteContentForm contentId={c.id} scope="admin" /></div>
          )}
        </section>
      ) : (
        <article className="mt-10 flex flex-col gap-4">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element -- 검토용 미리보기
            <img src={cover} alt="대표 사진" className="aspect-[4/3] w-full max-w-md object-cover" />
          )}
          <p className="font-medium">{c.summary}</p>
          <div className="leading-relaxed whitespace-pre-line" data-testid="content-body">{c.body}</div>
        </article>
      )}
    </div>
  );
}
