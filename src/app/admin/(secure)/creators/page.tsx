import type { Metadata } from "next";
import Link from "next/link";

import { StatusPill } from "@/components/forms/controls";
import { requireAdmin } from "@/lib/auth/guards";
import { CREATOR_STATUSES, creatorFieldLabel, creatorStatusLabel } from "@/lib/creators/constants";
import { listCreatorApplications } from "@/lib/creators/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "크리에이터 지원" };
export const instant = false;

const TABS = [{ value: "all", label: "전체" }, ...CREATOR_STATUSES];

export default async function AdminCreatorsPage({ searchParams }: PageProps<"/admin/creators">) {
  await requireAdmin("/admin/creators");
  const sp = (await searchParams) as { tab?: string };
  const tab = TABS.find((t) => t.value === sp.tab)?.value ?? "new";
  const all = await listCreatorApplications();
  const shown = tab === "all" ? all : all.filter((a) => a.status === tab);
  const count = (v: string) => (v === "all" ? all.length : all.filter((a) => a.status === v).length);

  return (
    <div>
      <h1 className="mb-2 font-display text-3xl font-bold">크리에이터 지원</h1>
      <p className="mb-6 text-sm text-muted-foreground">로그인 없이 접수된 지원이에요. 확인하고 전화 인터뷰를 진행한 뒤 상태를 바꿔 주세요.</p>
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="지원 상태">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/creators?tab=${t.value}`}
            aria-current={tab === t.value ? "page" : undefined}
            className={cn("border px-3 py-2 text-sm", tab === t.value ? "border-foreground bg-foreground text-background" : "hover:border-foreground")}
          >
            {t.label} <span className="opacity-70">{count(t.value)}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="empty-state">해당 상태의 지원이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {shown.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/creators/${a.id}`} className="flex flex-col gap-1 border px-4 py-3 hover:border-foreground" data-testid="creator-row" data-name={a.name}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{a.name}</span>
                  <StatusPill tone={a.status === "new" ? "warn" : a.status === "collaborating" ? "ok" : "muted"}>{creatorStatusLabel(a.status)}</StatusPill>
                </span>
                <span className="text-xs text-muted-foreground">
                  {creatorFieldLabel(a.field)} · {new Date(a.applied_at).toLocaleString("ko-KR")}
                </span>
                <span className="line-clamp-1 text-muted-foreground">{a.strength}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
