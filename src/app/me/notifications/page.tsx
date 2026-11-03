import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { SiteHeader } from "@/components/site-header";
import { requireMember } from "@/lib/auth/guards";
import { formatShortDateTime } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { markAllReadAction } from "./actions";

export const metadata: Metadata = { title: "알림" };
export const instant = false;

export default async function NotificationsPage() {
  const member = await requireMember("/me/notifications");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at")
    .eq("user_id", member.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-display text-3xl font-bold">알림</h1>
          {unread > 0 && <ActionForm action={async () => { "use server"; return markAllReadAction(); }} hidden={{}} label="모두 읽음" variant="ghost" />}
        </div>
        {items.length === 0 ? (
          <p className="mt-10 text-center text-muted-foreground">아직 알림이 없어요.</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-2" data-testid="notification-list">
            {items.map((n) => (
              <li key={n.id} data-testid="notification" data-kind={n.kind}>
                <Link href={n.link ?? "/me"} className={`block rounded-xl border p-4 ${n.read_at ? "" : "border-foreground"}`}>
                  <div className="flex justify-between gap-3">
                    <p className="font-medium">{!n.read_at && <span className="mr-2 inline-block size-2 rounded-full bg-accent align-middle" aria-label="읽지 않음" />}{n.title}</p>
                    <time className="shrink-0 text-xs text-muted-foreground">{formatShortDateTime(n.created_at)}</time>
                  </div>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
