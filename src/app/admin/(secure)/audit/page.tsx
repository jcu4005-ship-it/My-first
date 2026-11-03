import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "감사 기록" };

// 권한 확인이 끝나기 전에는 응답을 시작하지 않음 → 권한 없으면 HTTP 403
export const instant = false;

export default async function Page() {
  await requireAdmin("/admin/audit");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, actor_id, actor_kind, action, target_type, target_id, before, after, reason, created_at")
    .order("id", { ascending: false })
    .limit(100);
  return (
    <div>
      <h1 className="mb-2 font-display text-3xl font-bold">감사 기록</h1>
      <p className="mb-6 text-sm text-muted-foreground">최근 100건 · 이 기록은 누구도 수정하거나 삭제할 수 없습니다.</p>
      {error && <p role="alert" className="text-sm text-destructive">감사 기록을 불러오지 못했습니다.</p>}
    <ol className="flex flex-col gap-2 text-sm" data-testid="audit-list">
      {(data ?? []).map((log) => (
        <li key={log.id} className="rounded-lg border p-3" data-testid="audit-row" data-action={log.action}>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-medium">{log.action}</span>
            <time className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("ko-KR")}</time>
          </div>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {log.actor_kind} {log.actor_id ?? ""} → {log.target_type ?? ""} {log.target_id ?? ""}
          </p>
          {log.reason && <p className="mt-1">사유: {log.reason}</p>}
          {(log.before || log.after) && (
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {JSON.stringify(log.before)} → {JSON.stringify(log.after)}
            </p>
          )}
        </li>
      ))}
    </ol>
    </div>
  );
}
