import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { revealMemberEmailAction } from "../actions";
import { RevealForm } from "../reveal-form";

import { MemberActions } from "./member-actions";

export const metadata: Metadata = { title: "회원 관리" };

// 권한 확인이 끝나기 전에는 응답을 시작하지 않음 → 권한 없으면 HTTP 403
export const instant = false;

type Member = {
  id: string;
  nickname: string;
  email: string;
  status: "active" | "suspended" | "withdrawn";
  roles: string[];
  created_at: string;
};

const STATUS_LABEL = { active: "정상", suspended: "정지", withdrawn: "탈퇴" } as const;

export default async function Page({ searchParams }: PageProps<"/admin/members">) {
  const admin = await requireAdmin("/admin/members");
  const { q } = (await searchParams) as { q?: string };
  const search = typeof q === "string" ? q.slice(0, 100) : "";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_list_members", { p_search: search || null, p_limit: 50, p_offset: 0 });

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-bold">회원 관리</h1>
      <form className="mb-6 flex gap-2" role="search">
        <Input name="q" defaultValue={search} placeholder="닉네임 또는 이메일" aria-label="회원 검색" className="max-w-xs" />
        <Button type="submit" variant="outline">검색</Button>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">회원 목록을 불러오지 못했습니다.</p>}
      <p className="mb-4 text-xs text-muted-foreground">이메일은 가려서 보여 줘요. 원문은 사유를 적어야 볼 수 있고, 열람과 목록 조회는 모두 감사 기록에 남습니다. 검색은 전체 이메일로도 돼요.</p>
      <ul className="flex flex-col gap-3" data-testid="member-list">
        {((data ?? []) as Member[]).map((m) => (
          <li key={m.id} className="rounded-xl border p-4" data-testid="member-row" data-nickname={m.nickname}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="font-medium">{m.nickname}</span>
                <div className="mt-1 text-sm text-muted-foreground">
                  <RevealForm action={revealMemberEmailAction} targetId={m.id} masked={m.email} label="이메일" testId="email-reveal" />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                <span data-testid="member-roles">{m.roles.join(", ")}</span> · {STATUS_LABEL[m.status]}
              </div>
            </div>
            {m.id !== admin.id && <MemberActions userId={m.id} roles={m.roles} status={m.status} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
