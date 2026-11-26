import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { Stars } from "@/components/reviews/review-list";
import { requireAdmin } from "@/lib/auth/guards";
import { formatYmd } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { setReviewHiddenAction } from "../actions";

export const metadata: Metadata = { title: "후기 관리" };
export const instant = false;

type Row = {
  id: string;
  meetup_id: string;
  meetup_title: string;
  host_name: string;
  nickname: string;
  rating: number;
  body: string;
  host_reply: string | null;
  is_hidden: boolean;
  created_at: string;
};

export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requireAdmin("/admin/reviews");
  const hiddenOnly = (await searchParams).hidden === "1";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("admin_reviews", { p_hidden_only: hiddenOnly });
  const rows = (data as Row[] | null) ?? [];
  return (
    <div data-testid="admin-reviews">
      <h1 className="font-display text-3xl font-bold">후기 관리</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        욕설·개인정보·광고처럼 운영 원칙에 맞지 않는 후기만 가려 주세요. 가리기·다시 보이기는 사유와 함께 감사 기록에 남아요. 후기를 지우지는 않아요.
      </p>
      <nav className="mt-5 flex gap-2 text-sm">
        <Link href="/admin/reviews" className={`rounded-full border px-3 py-1 ${hiddenOnly ? "" : "border-foreground font-semibold"}`}>전체</Link>
        <Link href="/admin/reviews?hidden=1" className={`rounded-full border px-3 py-1 ${hiddenOnly ? "border-foreground font-semibold" : ""}`}>가린 후기</Link>
      </nav>
      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground" data-testid="admin-reviews-empty">후기가 없어요.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id} className={`rounded-xl border p-5 ${r.is_hidden ? "bg-secondary/60" : ""}`} data-testid="admin-review-item">
              <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <Stars value={r.rating} />
                <b>{r.nickname}</b>
                <span className="text-muted-foreground">
                  {formatYmd(r.created_at)} · <Link href={`/meetups/${r.meetup_id}`} className="underline underline-offset-4">{r.meetup_title}</Link> · {r.host_name}
                </span>
                {r.is_hidden && <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] text-background">가림</span>}
              </div>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{r.body}</p>
              {r.host_reply && <p className="mt-2 border-l-2 pl-3 text-sm text-muted-foreground">답글 · {r.host_reply}</p>}
              <ActionForm
                action={setReviewHiddenAction}
                hidden={{ reviewId: r.id, hidden: r.is_hidden ? "false" : "true" }}
                label={r.is_hidden ? "다시 보이기" : "가리기"}
                note={{ name: "reason", placeholder: "사유 (5자 이상, 감사 기록에 남아요)" }}
                className="mt-3"
                testId="review-hide-form"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
