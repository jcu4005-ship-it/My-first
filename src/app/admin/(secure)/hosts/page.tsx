import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { StatusPill } from "@/components/forms/controls";
import { requireAdmin } from "@/lib/auth/guards";
import { listHostApplications } from "@/lib/hosting/queries";

import { reviewHostAction } from "../actions";

export const metadata: Metadata = { title: "호스트 심사" };
export const instant = false;

const LABEL = { applied: "심사 대기", approved: "승인", rejected: "반려", suspended: "정지" } as const;

export default async function AdminHostsPage() {
  await requireAdmin("/admin/hosts");
  const apps = await listHostApplications();
  const pending = apps.filter((a) => a.status === "applied");
  const done = apps.filter((a) => a.status !== "applied");
  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-bold">호스트 심사</h1>
      <h2 className="mb-3 font-semibold">심사 대기 {pending.length}건</h2>
      {pending.length === 0 && <p className="mb-8 text-sm text-muted-foreground">대기 중인 신청이 없어요.</p>}
      <ul className="mb-10 flex flex-col gap-4">
        {pending.map((a) => (
          <li key={a.user_id} className="rounded-2xl border p-5" data-testid="host-application" data-name={a.display_name}>
            <p className="font-semibold">{a.display_name}</p>
            <p className="text-sm">{a.headline}</p>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{a.bio}</p>
            {a.expertise.length > 0 && <p className="mt-2 text-xs text-muted-foreground">관심 분야: {a.expertise.join(", ")}</p>}
            {a.instagram_handle && <p className="text-xs text-muted-foreground">Instagram @{a.instagram_handle}</p>}
            <div className="mt-4 flex flex-wrap items-start gap-4 border-t pt-4">
              <ActionForm action={reviewHostAction} hidden={{ userId: a.user_id, decision: "approve", note: "" }} label="승인" variant="default" testId="approve-host" />
              <ActionForm action={reviewHostAction} hidden={{ userId: a.user_id, decision: "reject" }} label="반려"
                note={{ name: "note", placeholder: "반려 사유 (5자 이상, 신청자에게 보여요)" }} />
            </div>
          </li>
        ))}
      </ul>
      <h2 className="mb-3 font-semibold">처리 완료</h2>
      <ul className="flex flex-col gap-2 text-sm">
        {done.map((a) => (
          <li key={a.user_id} className="flex items-center justify-between rounded-lg border px-4 py-3">
            <Link href={`/hosts/${a.user_id}`} className="hover:underline">{a.display_name}</Link>
            <StatusPill tone={a.status === "approved" ? "ok" : "muted"}>{LABEL[a.status]}</StatusPill>
          </li>
        ))}
      </ul>
    </div>
  );
}
