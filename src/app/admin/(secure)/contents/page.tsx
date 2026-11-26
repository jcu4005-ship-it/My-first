import type { Metadata } from "next";
import Link from "next/link";

import { StatusPill } from "@/components/forms/controls";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/guards";
import { listContentsForAdmin } from "@/lib/contents/queries";
import { CONTENT_STATUS_LABEL, CONTENT_STATUS_TONE, contentTypeInfo, type ContentStatus } from "@/lib/contents/types";
import { formatShortDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "콘텐츠 검토" };
export const instant = false;

const TABS: { key: ContentStatus | "mine"; label: string }[] = [
  { key: "submitted", label: "검토 대기" },
  { key: "published", label: "공개" },
  { key: "rejected", label: "보완 요청" },
  { key: "archived", label: "비공개" },
  { key: "mine", label: "내가 쓰는 글" },
];

export default async function AdminContentsPage({ searchParams }: PageProps<"/admin/contents">) {
  const admin = await requireAdmin("/admin/contents");
  const sp = (await searchParams) as { tab?: string };
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "submitted";
  const rows = await listContentsForAdmin(tab, admin.id);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-bold">콘텐츠 검토</h1>
        <Button asChild size="sm"><Link href="/admin/contents/new">운영팀 글 쓰기</Link></Button>
      </div>
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="콘텐츠 상태">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/contents?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}
            className={cn("border px-3 py-2 text-sm", tab === t.key ? "border-foreground bg-foreground text-background" : "hover:border-foreground")}>
            {t.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="empty-state">해당 상태의 콘텐츠가 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/contents/${c.id}`} className="flex flex-col gap-1 border p-4 hover:border-foreground" data-testid="admin-content-row" data-title={c.title}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={CONTENT_STATUS_TONE[c.status]}>{CONTENT_STATUS_LABEL[c.status]}</StatusPill>
                  <span className="text-xs text-muted-foreground">{contentTypeInfo(c.type)?.ko}</span>
                  {c.is_sample && <span className="text-xs text-muted-foreground">샘플</span>}
                </div>
                <p className="font-semibold">{c.title}</p>
                <p className="text-xs text-muted-foreground">
                  {c.host?.display_name ?? "운영팀"} · 작성 {c.author?.nickname ?? "-"} · {formatShortDateTime(c.updated_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
