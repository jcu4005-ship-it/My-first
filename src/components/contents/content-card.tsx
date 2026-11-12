import Link from "next/link";

import { Photo } from "@/components/media/photo";
import type { ContentCard as ContentCardData } from "@/lib/contents/queries";
import { contentCoverUrl, contentTypeInfo } from "@/lib/contents/types";
import { formatYmd } from "@/lib/format";

/** 저널 카드: 대표 사진(없으면 제목 표지), 종류, 제목, 요약, 호스트 */
export function ContentCard({ content, className = "" }: { content: ContentCardData; className?: string }) {
  const cover = contentCoverUrl(content.cover_path);
  const type = contentTypeInfo(content.type);
  return (
    <Link href={`/journal/${content.slug}`} className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card ${className}`} data-testid="content-card" data-title={content.title}>
      <span className="relative flex aspect-[16/10] items-start overflow-hidden bg-forest p-3 text-cream">
        <Photo
          src={cover}
          alt=""
          sizes="(min-width: 1024px) 33vw, 90vw"
          fallback={
            <span aria-hidden className="absolute inset-0 flex items-center justify-center p-6 text-center font-display text-2xl leading-snug text-cream/20">
              {content.title}
            </span>
          }
        />
        <span className="pill relative bg-white/95 text-forest shadow-sm">{type?.label ?? "Journal"}</span>
      </span>
      <span className="flex flex-1 flex-col p-4">
      <span className="text-xs text-muted-foreground">
        {[content.host?.display_name, content.published_at ? formatYmd(content.published_at) : null, content.is_sample ? "샘플" : null].filter(Boolean).join(" · ")}
      </span>
      <span className="mt-1.5 text-base leading-snug font-semibold group-hover:underline group-hover:underline-offset-4">{content.title}</span>
      <span className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{content.summary}</span>
      </span>
    </Link>
  );
}

export function ContentGrid({ contents }: { contents: ContentCardData[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {contents.map((c) => (
        <li key={c.id}>
          <ContentCard content={c} />
        </li>
      ))}
    </ul>
  );
}
