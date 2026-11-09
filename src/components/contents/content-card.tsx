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
    <Link href={`/journal/${content.slug}`} className={`group flex flex-col ${className}`} data-testid="content-card" data-title={content.title}>
      <span className="relative flex aspect-[4/3] items-end overflow-hidden bg-espresso p-5 text-sand-light">
        <Photo
          src={cover}
          alt=""
          sizes="(min-width: 1024px) 33vw, 90vw"
          fallback={
            <span aria-hidden className="absolute inset-0 flex items-center justify-center p-6 text-center font-display text-2xl leading-snug text-sand-light/20">
              {content.title}
            </span>
          }
        />
        <span className="eyebrow relative bg-espresso/70 px-2 py-1 text-[#d9b39e]">{type?.label ?? "Journal"}</span>
      </span>
      <span className="mt-4 text-xs text-muted-foreground">
        {[content.host?.display_name, content.published_at ? formatYmd(content.published_at) : null, content.is_sample ? "샘플" : null].filter(Boolean).join(" · ")}
      </span>
      <span className="mt-2 font-display text-xl leading-snug font-medium group-hover:underline">{content.title}</span>
      <span className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{content.summary}</span>
    </Link>
  );
}

export function ContentGrid({ contents }: { contents: ContentCardData[] }) {
  return (
    <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {contents.map((c) => (
        <li key={c.id}>
          <ContentCard content={c} />
        </li>
      ))}
    </ul>
  );
}
