import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PublicReview = {
  id: string;
  meetup_id: string;
  meetup_title: string;
  nickname: string;
  rating: number;
  body: string;
  host_reply: string | null;
  host_replied_at: string | null;
  created_at: string;
};

export type ReviewSummary = { count: number; avg: number | null };

/** 공개 후기 (숨긴 후기 제외, 작성자는 닉네임만). 프로그램 또는 크리에이터 기준 */
export async function listPublicReviews(by: { meetupId?: string; hostId?: string }, limit = 20): Promise<PublicReview[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("public_reviews", {
    p_meetup_id: by.meetupId ?? null,
    p_host_id: by.hostId ?? null,
    p_limit: limit,
  });
  return (data as PublicReview[] | null) ?? [];
}

export async function getReviewSummary(by: { meetupId?: string; hostId?: string }): Promise<ReviewSummary> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("review_summary", { p_meetup_id: by.meetupId ?? null, p_host_id: by.hostId ?? null });
  const row = (data as { review_count: number; avg_rating: number | string | null }[] | null)?.[0];
  return { count: row?.review_count ?? 0, avg: row?.avg_rating == null ? null : Number(row.avg_rating) };
}
