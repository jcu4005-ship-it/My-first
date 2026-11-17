import type { Metadata } from "next";
import Link from "next/link";

import { Stars } from "@/components/reviews/review-list";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { requireMember } from "@/lib/auth/guards";
import { formatShortDateTime } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "내 후기" };
export const instant = false;

type Row = {
  booking_id: string;
  meetup_id: string;
  title: string;
  host_name: string;
  starts_at: string;
  review_id: string | null;
  rating: number | null;
  can_write: boolean;
};

export default async function MyReviewsPage() {
  await requireMember("/me/reviews");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("my_reviewable_bookings");
  const rows = (data as Row[] | null) ?? [];
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-8 pb-14 sm:px-6 sm:pt-12">
        <p className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground">REVIEWS</p>
        <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">참가 후기</h1>
        <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
          참가한 프로그램이 끝나면 30일 안에 후기를 남길 수 있어요. 후기에는 닉네임만 보여요.
        </p>
        {rows.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-border bg-card/60 px-6 py-14 text-center" data-testid="my-reviews-empty">
            <p className="font-semibold">아직 다녀온 프로그램이 없어요</p>
            <Link href="/meetups" className="mt-3 inline-block text-sm font-semibold text-forest underline-offset-4 hover:underline">
              프로그램 둘러보기
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="my-reviews">
            {rows.map((r) => (
              <li key={r.booking_id} className="rounded-[20px] bg-card p-5" data-testid="my-review-item">
                <Link href={`/meetups/${r.meetup_id}`} className="font-semibold hover:underline hover:underline-offset-4">
                  {r.title}
                </Link>
                <p className="text-[12.5px] text-muted-foreground">
                  {r.host_name} · {formatShortDateTime(r.starts_at)}
                </p>
                {r.review_id ? (
                  <p className="mt-2 flex items-center gap-2 text-sm" data-testid="review-done">
                    <Stars value={r.rating ?? 0} /> 후기를 남겼어요
                  </p>
                ) : r.can_write ? (
                  <ReviewForm bookingId={r.booking_id} title={r.title} />
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">후기를 남길 수 있는 기간이 지났어요.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
