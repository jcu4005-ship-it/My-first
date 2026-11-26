import type { Metadata } from "next";
import Link from "next/link";

import { ContentGrid } from "@/components/contents/content-card";
import { PageHero } from "@/components/layout/page-parts";
import { chipClass } from "@/components/meetups/category-chips";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listPublishedContents } from "@/lib/contents/queries";
import { CONTENT_TYPES, contentTypeInfo, isContentType } from "@/lib/contents/types";

export const instant = false;
export const metadata: Metadata = { title: "저널", description: "호스트의 작업 이야기, 인터뷰, 포트폴리오." };

export default async function JournalPage({ searchParams }: PageProps<"/journal">) {
  const sp = (await searchParams) as { type?: string };
  const type = isContentType(sp.type) ? sp.type : undefined;
  const contents = await listPublishedContents({ type });
  const info = contentTypeInfo(type);
  const tab = chipClass;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          title={info ? info.ko : "호스트의 이야기"}
          description="프로그램 너머의 작업과 생각. 호스트가 쓰고 운영팀이 검토한 글만 실립니다."
        />
        <div className="sticky top-16 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
          <nav aria-label="콘텐츠 종류" className="mx-auto w-full max-w-6xl overflow-x-auto px-4 no-scrollbar sm:px-6">
            <ul className="flex w-max gap-2 py-3">
              <li><Link href="/journal" className={tab(!type)} aria-current={!type ? "page" : undefined} data-testid="content-type-tab">전체</Link></li>
              {CONTENT_TYPES.map((t) => (
                <li key={t.slug}>
                  <Link href={`/journal?type=${t.slug}`} className={tab(type === t.slug)} aria-current={type === t.slug ? "page" : undefined} data-testid="content-type-tab">
                    {t.ko}
                    <span className="sr-only"> ({t.label})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
          {contents.length ? (
            <ContentGrid contents={contents} />
          ) : (
            <div className="rounded-3xl border border-dashed border-border px-6 py-16 text-center" data-testid="empty-state">
              <p className="font-display text-xl font-bold text-forest">아직 실린 글이 없어요</p>
              <p className="mt-2 text-sm text-muted-foreground">호스트들의 첫 이야기를 준비하고 있어요.</p>
              <Link href="/hosts" className="mt-5 inline-block text-sm font-semibold text-forest underline-offset-4 hover:underline">호스트 둘러보기</Link>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
