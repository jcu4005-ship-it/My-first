import type { Metadata } from "next";
import Link from "next/link";

import { StatusPill } from "@/components/forms/controls";
import { pillarInfo } from "@/config/pillars";
import { requireAdmin } from "@/lib/auth/guards";
import { APPLICATION_STATUS_LABEL, listApplicationsForAdmin, type ApplicationStatus } from "@/lib/hosting/applications";
import { hostHref } from "@/lib/hosting/avatar";
import { listHostApplications } from "@/lib/hosting/queries";
import { cn } from "@/lib/utils";

import { HostListingForm } from "./listing-form";

export const metadata: Metadata = { title: "호스트 심사" };
export const instant = false;

const TABS: { key: ApplicationStatus | "open"; label: string }[] = [
  { key: "open", label: "처리 필요" },
  { key: "revision_requested", label: "수정 요청" },
  { key: "approved", label: "승인" },
  { key: "rejected", label: "반려" },
];

export default async function AdminHostsPage({ searchParams }: PageProps<"/admin/hosts">) {
  await requireAdmin("/admin/hosts");
  const sp = (await searchParams) as { tab?: string };
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "open") as (typeof TABS)[number]["key"];
  const [apps, hosts] = await Promise.all([listApplicationsForAdmin(), listHostApplications()]);
  const shown = apps.filter((a) => (tab === "open" ? a.status === "submitted" || a.status === "reviewing" : a.status === tab));
  const approvedHosts = hosts.filter((h) => h.status === "approved");

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-bold">호스트 심사</h1>
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="지원서 상태">
        {TABS.map((t) => {
          const count = apps.filter((a) => (t.key === "open" ? a.status === "submitted" || a.status === "reviewing" : a.status === t.key)).length;
          return (
            <Link key={t.key} href={`/admin/hosts?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}
              className={cn("border px-3 py-2 text-sm", tab === t.key ? "border-foreground bg-foreground text-background" : "hover:border-foreground")}>
              {t.label} {count}
            </Link>
          );
        })}
      </nav>

      {shown.length === 0 ? (
        <p className="mb-10 text-sm text-muted-foreground" data-testid="empty-state">해당 상태의 지원서가 없어요.</p>
      ) : (
        <ul className="mb-12 flex flex-col gap-3">
          {shown.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/hosts/${a.id}`} className="flex flex-col gap-2 border p-4 hover:border-foreground sm:flex-row sm:items-center sm:justify-between"
                data-testid="host-application" data-name={a.display_name}>
                <span>
                  <span className="font-semibold">{a.display_name || "(이름 없음)"}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{pillarInfo(a.pillar)?.label ?? "분류 없음"}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{a.headline}</span>
                </span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  {a.submitted_at && new Date(a.submitted_at).toLocaleDateString("ko-KR")}
                  <StatusPill tone={a.status === "approved" ? "ok" : a.status === "rejected" ? "muted" : "warn"}>{APPLICATION_STATUS_LABEL[a.status]}</StatusPill>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-1 font-semibold">승인된 호스트 {approvedHosts.length}명</h2>
      <p className="mb-3 text-xs text-muted-foreground">대표 분류와 추천 여부를 정할 수 있어요. 추천은 팔로워 수와 관계없이 운영팀이 직접 고릅니다.</p>
      <ul className="flex flex-col gap-2 text-sm">
        {approvedHosts.map((a) => (
          <li key={a.user_id} className="flex flex-col gap-3 border px-4 py-3" data-testid="host-row" data-name={a.display_name}>
            <Link href={hostHref(a)} className="hover:underline">{a.display_name}</Link>
            <HostListingForm userId={a.user_id} pillar={a.primary_pillar} featured={a.is_featured} order={a.featured_order} />
          </li>
        ))}
      </ul>
    </div>
  );
}
