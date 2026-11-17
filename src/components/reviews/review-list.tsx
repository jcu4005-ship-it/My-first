import Link from "next/link";
import { Star } from "lucide-react";

import { formatYmd } from "@/lib/format";
import type { PublicReview, ReviewSummary } from "@/lib/reviews/queries";
import { cn } from "@/lib/utils";

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5 text-ember", className)} role="img" aria-label={`별점 5점 중 ${value}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className="size-3.5" strokeWidth={1.6} fill={n <= Math.round(value) ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

/**
 * 참가 후기 목록. 실제로 참가한 사람만 쓸 수 있고(DB가 확인), 숨긴 후기는 나오지 않아요.
 * 후기가 없으면 "아직 후기가 없어요" — 지어낸 후기는 넣지 않습니다.
 */
export function ReviewSection({
  reviews,
  summary,
  showProgram = false,
  title = "참가 후기",
}: {
  reviews: PublicReview[];
  summary: ReviewSummary;
  showProgram?: boolean;
  title?: string;
}) {
  return (
    <section className="mt-12" aria-labelledby="reviews-title" data-testid="reviews">
      <div className="flex items-end justify-between gap-3 border-b border-foreground pb-2.5">
        <h2 id="reviews-title" className="text-[18px] font-extrabold tracking-[-0.02em]">
          {title}
        </h2>
        {summary.count > 0 && summary.avg != null && (
          <p className="flex items-center gap-1.5 text-[13px]" data-testid="review-summary">
            <Stars value={summary.avg} />
            <b className="tabular-nums">{summary.avg.toFixed(1)}</b>
            <span className="text-fog">· 후기 {summary.count}개</span>
          </p>
        )}
      </div>
      {reviews.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground" data-testid="reviews-empty">
          아직 후기가 없어요. 참가한 분만 프로그램이 끝난 뒤 후기를 남길 수 있어요.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {reviews.map((r) => (
            <li key={r.id} className="py-5" data-testid="review-item">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
                <Stars value={r.rating} />
                <b>{r.nickname}</b>
                <span className="text-fog">{formatYmd(r.created_at)}</span>
                {showProgram && (
                  <Link href={`/meetups/${r.meetup_id}`} className="text-fog underline-offset-4 hover:underline">
                    · {r.meetup_title}
                  </Link>
                )}
              </div>
              <p className="mt-2 text-[14.5px] leading-relaxed whitespace-pre-line break-keep">{r.body}</p>
              {r.host_reply && (
                <div className="mt-3 border-l-2 border-forest/40 bg-linen/50 px-3.5 py-2.5 text-[13.5px]" data-testid="review-reply">
                  <p className="text-[11px] font-bold tracking-[0.14em] text-forest">크리에이터의 답글</p>
                  <p className="mt-1 leading-relaxed whitespace-pre-line">{r.host_reply}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
