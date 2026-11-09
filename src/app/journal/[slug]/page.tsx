import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentGrid } from "@/components/contents/content-card";
import { Photo } from "@/components/media/photo";
import { RecordRecentlyViewed } from "@/components/recently-viewed";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brand } from "@/config/brand";
import { getPublishedContent, listPublishedContents } from "@/lib/contents/queries";
import { contentCoverUrl, contentTypeInfo } from "@/lib/contents/types";
import { formatYmd } from "@/lib/format";
import { hostAvatarUrl, hostHref } from "@/lib/hosting/avatar";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/journal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await getPublishedContent(slug);
  return c ? { title: c.title, description: c.summary } : { title: "글을 찾을 수 없습니다" };
}

export default async function JournalArticlePage({ params }: PageProps<"/journal/[slug]">) {
  const { slug } = await params;
  const c = await getPublishedContent(slug);
  if (!c) notFound();
  const more = c.host ? (await listPublishedContents({ hostId: c.host.user_id, limit: 4 })).filter((x) => x.id !== c.id).slice(0, 3) : [];
  const cover = contentCoverUrl(c.cover_path);
  const type = contentTypeInfo(c.type);
  const avatar = hostAvatarUrl(c.host?.avatar_path);
  // 본문: 일반 텍스트. 빈 줄로 문단을 나누고, 그 안의 줄바꿈은 그대로
  const paragraphs = c.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <>
      <SiteHeader />
      <RecordRecentlyViewed item={{ kind: "content", href: `/journal/${c.slug}`, title: c.title }} />
      <main className="flex-1">
        <article>
          <header className="mx-auto w-full max-w-3xl px-4 pt-12 sm:px-8 sm:pt-20">
            <Link href={`/journal?type=${c.type}`} className="eyebrow text-muted-foreground">{type?.label} · {type?.ko}</Link>
            <h1 className="mt-4 font-display text-3xl leading-tight font-medium break-keep sm:text-5xl" data-testid="content-title">{c.title}</h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{c.summary}</p>
            <p className="mt-6 text-sm text-muted-foreground">
              {[c.host?.display_name ?? `${brand.name} 운영팀`, c.published_at ? formatYmd(c.published_at) : null, c.is_sample ? "샘플" : null].filter(Boolean).join(" · ")}
            </p>
          </header>
          {cover && (
            <div className="relative mx-auto mt-10 aspect-[16/10] w-full max-w-5xl overflow-hidden bg-espresso">
              <Photo src={cover} alt="" priority sizes="(min-width: 1024px) 1024px, 100vw" fallback={null} />
            </div>
          )}
          <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8" data-testid="content-body">
            {paragraphs.map((p, i) => (
              <p key={i} className="mb-6 text-[1.05rem] leading-[1.9] break-keep whitespace-pre-line">{p}</p>
            ))}
          </div>
        </article>

        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-16 sm:px-8">
          {c.host && (
            <Link href={hostHref(c.host)} className="flex items-center gap-4 border p-4 hover:border-foreground" data-testid="content-host">
              <span className="relative size-16 shrink-0 overflow-hidden bg-espresso text-sand-light">
                <Photo src={avatar} alt="" sizes="64px"
                  fallback={<span className="absolute inset-0 flex items-center justify-center font-display text-2xl">{c.host.display_name.slice(0, 1)}</span>} />
              </span>
              <span>
                <span className="eyebrow block text-muted-foreground">Host</span>
                <span className="font-medium">{c.host.display_name}</span>
              </span>
            </Link>
          )}
          {c.related && (
            <Link href={`/meetups/${c.related.id}`} className="flex flex-col gap-1 border p-4 hover:border-foreground" data-testid="content-related">
              <span className="eyebrow text-muted-foreground">관련 프로그램</span>
              <span className="font-medium">{c.related.title}</span>
              <span className="line-clamp-2 text-sm text-muted-foreground">{c.related.summary}</span>
            </Link>
          )}
        </div>

        {more.length > 0 && (
          <section className="border-t">
            <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-8">
              <p className="eyebrow text-muted-foreground">More from {c.host?.display_name}</p>
              <h2 className="mt-2 mb-8 font-display text-2xl font-medium">이 호스트의 다른 글</h2>
              <ContentGrid contents={more} />
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
