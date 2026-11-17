import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { purgeStalePiiAction } from "./actions";

type Overview = {
  members_total: number;
  members_new_7d: number;
  bookings_7d: number;
  bookings_upcoming: number;
  hosts_approved: number;
  reviews_7d: number;
  avg_rating: number | string | null;
  reviews_hidden: number;
};

export const metadata: Metadata = { title: "관리자" };

// 권한 확인이 끝나기 전에는 응답을 시작하지 않음 → 권한 없으면 HTTP 403
export const instant = false;

export default async function Page() {
  const admin = await requireAdmin("/admin");
  const supabase = await createSupabaseServerClient();
  const [hosts, meetups, published, stale, support] = await Promise.all([
    // 호스트 지원은 지원서 표(host_applications)로 옮겨졌어요: 제출·심사 중인 지원서
    supabase.from("host_applications").select("id", { count: "exact", head: true }).in("status", ["submitted", "reviewing"]),
    supabase.from("meetups").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("meetups").select("id", { count: "exact", head: true }).eq("status", "published").eq("is_sample", false),
    supabase.rpc("admin_count_stale_pii"),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const { data: ov } = await supabase.rpc("admin_overview");
  const o = (ov as Overview[] | null)?.[0];
  const numbers = [
    { label: "회원", value: o?.members_total ?? 0, sub: `최근 7일 +${o?.members_new_7d ?? 0}` },
    { label: "최근 7일 확정 신청", value: o?.bookings_7d ?? 0, sub: `다가오는 참가 ${o?.bookings_upcoming ?? 0}건`, href: "/admin/bookings" },
    { label: "활동 중인 크리에이터", value: o?.hosts_approved ?? 0, sub: "테스트·샘플 제외" },
    { label: "평균 별점", value: o?.avg_rating != null ? Number(o.avg_rating).toFixed(1) : "–", sub: `최근 7일 후기 ${o?.reviews_7d ?? 0} · 가림 ${o?.reviews_hidden ?? 0}`, href: "/admin/reviews" },
  ];
  const staleCount = typeof stale.data === "number" ? stale.data : 0;
  const cards = [
    { href: "/admin/meetups", label: "검수 대기 프로그램", value: meetups.count ?? 0 },
    { href: "/admin/hosts", label: "심사 대기 호스트", value: hosts.count ?? 0 },
    { href: "/admin/meetups?status=published", label: "공개 중인 실제 프로그램", value: published.count ?? 0 },
    { href: "/admin/support", label: "답변 대기 문의", value: support.count ?? 0 },
  ];
  return (
    <div data-testid="admin-dashboard">
      <h1 className="font-display text-3xl font-bold">관리자 대시보드</h1>
      <p className="mt-3 text-muted-foreground">{admin.nickname}님 · 2단계 인증 완료</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="admin-overview">
        {numbers.map((c) => {
          const inner = (
            <>
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{c.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.sub}</p>
            </>
          );
          return (
            <li key={c.label} className="rounded-xl border bg-card">
              {c.href ? <Link href={c.href} className="block p-5 hover:border-foreground">{inner}</Link> : <div className="p-5">{inner}</div>}
            </li>
          );
        })}
      </ul>
      <h2 className="mt-8 text-sm font-semibold text-muted-foreground">처리할 일</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="block rounded-xl border p-5 hover:border-foreground">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{c.value}</p>
            </Link>
          </li>
        ))}
      </ul>
      <section className="mt-10 rounded-xl border p-5" data-testid="pii-retention">
        <h2 className="font-semibold">개인정보 보관 기간 정리</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          반려되고 1년이 지났거나, 1년 동안 제출하지 않은 지원서의 휴대폰 번호와 경력·기획안을 지워요. 승인된 지원서는 대상이 아니에요.
        </p>
        <p className="mt-3 text-sm">정리 대상 <strong className="tabular-nums" data-testid="pii-stale-count">{staleCount}</strong>건</p>
        {staleCount > 0 && (
          <ActionForm action={purgeStalePiiAction} hidden={{}} label="지금 정리하기" className="mt-3"
            confirmText="보관 기간이 지난 지원서 개인정보를 지울까요? 되돌릴 수 없어요." testId="pii-purge" />
        )}
      </section>
      <p className="mt-8 text-xs text-muted-foreground">거래·정산 메뉴는 결제 연동 단계에서 추가됩니다.</p>
    </div>
  );
}
