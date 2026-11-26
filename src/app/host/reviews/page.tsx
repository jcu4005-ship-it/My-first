import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ActionForm } from "@/components/forms/action-form";
import { Stars } from "@/components/reviews/review-list";
import { SiteHeader } from "@/components/site-header";
import { requireActiveMember } from "@/lib/auth/guards";
import { formatYmd } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { replyReviewAction } from "../actions";

export const metadata: Metadata = { title: "받은 후기" };
export const instant = false;

type Row = {
  id: string;
  meetup_id: string;
  meetup_title: string;
  nickname: string;
  rating: number;
  body: string;
  host_reply: string | null;
  is_hidden: boolean;
  created_at: string;
};

export default async function HostReviewsPage() {
  const member = await requireActiveMember("/host/reviews");
  if (!member.roles.includes("host")) redirect("/become-a-host/apply");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("host_my_reviews");
  const rows = (data as Row[] | null) ?? [];
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-8" data-testid="host-reviews">
        <Link href="/host" className="text-sm text-muted-foreground">← 호스트 홈</Link>
        <h1 className="mt-3 font-display text-3xl font-bold">받은 후기</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          참가한 분만 후기를 쓸 수 있어요. 답글은 공개 페이지에 함께 보이고, 후기를 쓴 분께 알림이 가요. 운영 원칙에 맞지 않는 후기는 운영팀이 가릴 수 있어요.
        </p>
        {rows.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground" data-testid="host-reviews-empty">
            아직 받은 후기가 없어요.
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl border p-5" data-testid="host-review-item">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <Stars value={r.rating} />
                  <b>{r.nickname}</b>
                  <span className="text-muted-foreground">{formatYmd(r.created_at)} · {r.meetup_title}</span>
                  {r.is_hidden && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">운영팀이 가린 후기</span>}
                </div>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{r.body}</p>
                {r.host_reply && (
                  <p className="mt-3 border-l-2 border-forest/40 pl-3 text-sm text-muted-foreground" data-testid="my-reply">
                    내 답글 · {r.host_reply}
                  </p>
                )}
                <ActionForm
                  action={replyReviewAction}
                  hidden={{ reviewId: r.id }}
                  label={r.host_reply ? "답글 고치기" : "답글 남기기"}
                  note={{ name: "reply", placeholder: "와 주셔서 고마워요 (2~500자)" }}
                  className="mt-3"
                  testId="reply-form"
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
