import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/forms/action-form";
import { StatusPill } from "@/components/forms/controls";
import { pillarInfo } from "@/config/pillars";
import { requireAdmin } from "@/lib/auth/guards";
import { APPLICATION_STATUS_LABEL, getApplicationForAdmin, listApplicationHistory } from "@/lib/hosting/applications";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { revealApplicationContactAction, reviewApplicationAction } from "../../actions";
import { RevealForm } from "../../reveal-form";

export const metadata: Metadata = { title: "지원서 상세" };
export const instant = false;

const ACTION_LABEL: Record<string, string> = {
  "host_application.submit": "제출",
  "host_application.start_review": "심사 시작",
  "host_application.request_revision": "수정 요청",
  "host_application.approve": "승인",
  "host_application.reject": "반려",
};

export default async function AdminApplicationPage({ params }: PageProps<"/admin/hosts/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/hosts/${id}`);
  const app = await getApplicationForAdmin(id);
  if (!app) notFound();
  const supabase = await createSupabaseServerClient();
  const [history, { data: maskedPhone }] = await Promise.all([
    listApplicationHistory(app.id),
    supabase.rpc("admin_application_contact", { p_id: app.id, p_reveal: false, p_reason: null }),
  ]);
  const open = app.status === "submitted" || app.status === "reviewing";

  const rows: [string, string | null][] = [
    ["호스트 이름", app.display_name],
    ["지원 분류", pillarInfo(app.pillar) ? `${pillarInfo(app.pillar)!.label} · ${pillarInfo(app.pillar)!.ko}` : null],
    ["활동 분야", app.fields.join(", ")],
    ["한 줄 소개", app.headline],
    ["자기소개", app.bio],
    ["전문성·경력", app.career],
    ["자격·수상", app.credentials],
    ["가르친 경험", app.teaching_experience],
    ["포트폴리오", app.portfolio_url],
    ["인스타그램", app.instagram_handle ? `@${app.instagram_handle}` : null],
    ["프로그램 기획안", app.program_proposal],
    ["참가자에게 줄 가치", app.value_to_participants],
    ["희망 운영 방식", app.preferred_format],
    ["자료 이용 동의", app.consented_at ? new Date(app.consented_at).toLocaleString("ko-KR") : "미동의"],
  ];

  return (
    <div className="max-w-3xl" data-testid="application-detail" data-status={app.status}>
      <Link href="/admin/hosts" className="text-sm text-muted-foreground">← 호스트 심사</Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">{app.display_name || "(이름 없음)"}</h1>
        <StatusPill tone={app.status === "approved" ? "ok" : app.status === "rejected" ? "muted" : "warn"}>{APPLICATION_STATUS_LABEL[app.status]}</StatusPill>
      </div>
      {app.review_note && <p className="mt-3 bg-notice px-4 py-3 text-sm text-notice-foreground">최근 메모: {app.review_note}</p>}

      <dl className="mt-6 flex flex-col text-sm">
        <div className="grid gap-1 border-b py-3 sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">휴대폰 (비공개)</dt>
          <dd>
            <RevealForm action={revealApplicationContactAction} targetId={app.id} masked={typeof maskedPhone === "string" ? maskedPhone : "-"}
              label="휴대폰 번호" testId="contact-reveal" />
          </dd>
        </div>
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 border-b py-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="break-all whitespace-pre-line">
              {k === "포트폴리오" && v ? <a href={v} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">{v}</a> : v || "-"}
            </dd>
          </div>
        ))}
      </dl>

      {open && (
        <section className="mt-8 flex flex-col gap-5 border p-5" data-testid="review-actions">
          <p className="font-semibold">심사</p>
          <div className="flex flex-wrap items-start gap-4">
            {app.status === "submitted" && (
              <ActionForm action={reviewApplicationAction} hidden={{ applicationId: app.id, action: "start_review", note: "" }} label="심사 시작" testId="start-review" />
            )}
            <ActionForm action={reviewApplicationAction} hidden={{ applicationId: app.id, action: "approve", note: "" }} label="승인" variant="default" testId="approve-host" />
          </div>
          <ActionForm action={reviewApplicationAction} hidden={{ applicationId: app.id, action: "request_revision" }} label="수정 요청"
            note={{ name: "note", placeholder: "수정 요청 내용 (5자 이상, 지원자에게 보여요)" }} testId="request-revision" />
          <ActionForm action={reviewApplicationAction} hidden={{ applicationId: app.id, action: "reject" }} label="반려"
            note={{ name: "note", placeholder: "반려 사유 (5자 이상, 지원자에게 보여요)" }} testId="reject-host" />
        </section>
      )}

      <section className="mt-8">
        <p className="mb-3 font-semibold">처리 이력</p>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">기록이 없어요.</p>
        ) : (
          <ol className="flex flex-col gap-2 text-sm" data-testid="application-history">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap gap-x-3 border-b pb-2">
                <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("ko-KR")}</span>
                <span className="font-medium">{ACTION_LABEL[h.action] ?? h.action}</span>
                {h.reason && <span className="text-muted-foreground">— {h.reason}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
