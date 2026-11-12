import type { Metadata } from "next";
import Link from "next/link";

import { ContentGrid } from "@/components/contents/content-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listPublishedContents } from "@/lib/contents/queries";
import { CONTENT_TYPES, contentTypeInfo, isContentType } from "@/lib/contents/types";
import { cn } from "@/lib/utils";

export const instant = false;
export const metadata: Metadata = { title: "저널", description: "호스트의 작업 이야기, 인터뷰, 포트폴리오." };

export default async function JournalPage({ searchParams }: PageProps<"/journal">) {
  const sp = (await searchParams) as { type?: string };
  const type = isContentType(sp.type) ? sp.type : undefined;
  const contents = await listPublishedContents({ type });
  const info = contentTypeInfo(type);
  const tab = (active: boolean) =>
    cn("block shrink-0 whitespace-nowrap border-b-2 py-4 text-sm transition-colors", active ? "border-foreground font-semibold" : "border-transparent text-muted-foreground hover:text-foreground");

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="section-dark">
          <div className="mx-auto w-full max-w-7xl px-4 pt-14 pb-12 sm:px-8 sm:pt-20 sm:pb-16">
            <p className="eyebrow text-muted-foreground">{info ? info.label : "Journal"}</p>
            <h1 className="mt-4 font-display text-4xl font-medium sm:text-6xl">{info ? info.ko : "호스트의 이야기"}</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-linen sm:text-base">
              프로그램 너머의 작업과 생각. 호스트가 쓰고 운영팀이 검토한 글만 실립니다.
            </p>
          </div>
        </section>
        <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <nav aria-label="콘텐츠 종류" className="mx-auto w-full max-w-7xl overflow-x-auto px-4 no-scrollbar sm:px-8">
            <ul className="flex w-max gap-6 sm:gap-8">
              <li><Link href="/journal" className={tab(!type)} aria-current={!type ? "page" : undefined} data-testid="content-type-tab">전체</Link></li>
              {CONTENT_TYPES.map((t) => (
                <li key={t.slug}>
                  <Link href={`/journal?type=${t.slug}`} className={tab(type === t.slug)} aria-current={type === t.slug ? "page" : undefined} data-testid="content-type-tab">
                    {t.label} <span className="text-xs opacity-70">{t.ko}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-8 sm:py-16">
          {contents.length ? (
            <ContentGrid contents={contents} />
          ) : (
            <div className="border-y py-20 text-center" data-testid="empty-state">
              <p className="font-display text-2xl">아직 실린 글이 없어요</p>
              <p className="mt-3 text-sm text-muted-foreground">호스트들의 첫 이야기를 준비하고 있어요.</p>
              <Link href="/hosts" className="eyebrow mt-8 inline-block border-b border-current pb-1">호스트 둘러보기</Link>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
