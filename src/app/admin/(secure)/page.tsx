import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "관리자" };

// 권한 확인이 끝나기 전에는 응답을 시작하지 않음 → 권한 없으면 HTTP 403
export const instant = false;

export default async function Page() {
  const admin = await requireAdmin("/admin");
  const supabase = await createSupabaseServerClient();
  const [hosts, meetups, published] = await Promise.all([
    supabase.from("host_profiles").select("user_id", { count: "exact", head: true }).eq("status", "applied"),
    supabase.from("meetups").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("meetups").select("id", { count: "exact", head: true }).eq("status", "published").eq("is_sample", false),
  ]);
  const cards = [
    { href: "/admin/meetups", label: "검수 대기 프로그램", value: meetups.count ?? 0 },
    { href: "/admin/hosts", label: "심사 대기 호스트", value: hosts.count ?? 0 },
    { href: "/admin/meetups?status=published", label: "공개 중인 실제 프로그램", value: published.count ?? 0 },
  ];
  return (
    <div data-testid="admin-dashboard">
      <h1 className="font-display text-3xl font-bold">관리자 대시보드</h1>
      <p className="mt-3 text-muted-foreground">{admin.nickname}님 · 2단계 인증 완료</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="block rounded-xl border p-5 hover:border-foreground">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{c.value}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs text-muted-foreground">거래·정산 메뉴는 결제 연동 단계에서 추가됩니다.</p>
    </div>
  );
}
