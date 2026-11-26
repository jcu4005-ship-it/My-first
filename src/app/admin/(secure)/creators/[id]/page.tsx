import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusPill } from "@/components/forms/controls";
import { requireAdmin } from "@/lib/auth/guards";
import { CREATOR_NOTE_KINDS, creatorFieldLabel, creatorStatusLabel } from "@/lib/creators/constants";
import { getCreatorApplication, listCreatorNotes } from "@/lib/creators/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { RevealForm } from "../../reveal-form";
import { addCreatorNoteAction, revealCreatorContactAction, setCreatorStatusAction } from "../actions";
import { NoteForm, StatusForm } from "../creator-forms";

export const metadata: Metadata = { title: "크리에이터 지원 상세" };
export const instant = false;

export default async function AdminCreatorDetailPage({ params }: PageProps<"/admin/creators/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/creators/${id}`);
  const app = await getCreatorApplication(id);
  if (!app) notFound();
  const supabase = await createSupabaseServerClient();
  const [notes, { data: maskedPhone }] = await Promise.all([
    listCreatorNotes(app.id),
    supabase.rpc("admin_creator_application_contact", { p_id: app.id, p_reveal: false, p_reason: null }),
  ]);

  const rows: [string, string | null][] = [
    ["관심 분야", creatorFieldLabel(app.field)],
    ["잘하거나 자신 있는 것", app.strength],
    ["관련 활동·경험", app.experience],
    ["함께하고 싶은 이유", app.motivation],
    ["SNS·포트폴리오", app.link_url],
    ["함께 해보고 싶은 활동", app.wished_activity],
    ["지원 일시", new Date(app.applied_at).toLocaleString("ko-KR")],
  ];

  return (
    <div className="max-w-3xl" data-testid="creator-detail" data-status={app.status}>
      <Link href="/admin/creators" className="text-sm text-muted-foreground">← 크리에이터 지원</Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">{app.name}</h1>
        <StatusPill tone={app.status === "new" ? "warn" : app.status === "collaborating" ? "ok" : "muted"}>{creatorStatusLabel(app.status)}</StatusPill>
      </div>

      <section className="mt-6 flex flex-col gap-3 border p-5">
        <p className="font-semibold">지원 상태</p>
        <StatusForm action={setCreatorStatusAction} id={app.id} current={app.status} />
      </section>

      <dl className="mt-6 flex flex-col text-sm">
        <div className="grid gap-1 border-b py-3 sm:grid-cols-[11rem_1fr]">
          <dt className="text-muted-foreground">휴대폰 (비공개)</dt>
          <dd>
            <RevealForm action={revealCreatorContactAction} targetId={app.id} masked={typeof maskedPhone === "string" ? maskedPhone : "-"} label="휴대폰 번호" testId="creator-contact" />
          </dd>
        </div>
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 border-b py-3 sm:grid-cols-[11rem_1fr]">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="break-all whitespace-pre-line">
              {k === "SNS·포트폴리오" && v ? <a href={v} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">{v}</a> : v || "-"}
            </dd>
          </div>
        ))}
      </dl>

      <section className="mt-8 flex flex-col gap-4" aria-labelledby="notes-title">
        <h2 id="notes-title" className="font-semibold">전화 인터뷰 메모</h2>
        <NoteForm action={addCreatorNoteAction} id={app.id} />
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 메모가 없어요.</p>
        ) : (
          <ol className="flex flex-col gap-3" data-testid="creator-notes">
            {notes.map((n) => (
              <li key={n.id} className="border p-4 text-sm">
                <p className="mb-2 text-xs text-muted-foreground">
                  {CREATOR_NOTE_KINDS.find((k) => k.value === n.kind)?.label ?? n.kind} · {new Date(n.created_at).toLocaleString("ko-KR")}
                </p>
                <p className="whitespace-pre-line">{n.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
