import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { pillarInfo } from "@/config/pillars";
import { requireActiveMember } from "@/lib/auth/guards";
import { APPLICATION_STATUS_LABEL, getMyApplication, type HostApplicationRow } from "@/lib/hosting/applications";
import { getMyHostProfile } from "@/lib/hosting/queries";

import { ApplicationForm } from "./application-form";

export const metadata: Metadata = { title: "호스트 지원" };
export const instant = false;

const STEPS: { key: HostApplicationRow["status"]; label: string }[] = [
  { key: "draft", label: "작성" },
  { key: "submitted", label: "제출" },
  { key: "reviewing", label: "심사" },
  { key: "approved", label: "결과" },
];

function toDefaults(a: HostApplicationRow | null): Record<string, string> {
  if (!a) return {};
  return {
    displayName: a.display_name, contactPhone: a.contact_phone, pillar: a.pillar ?? "", fields: a.fields.join(", "),
    headline: a.headline, bio: a.bio, career: a.career, credentials: a.credentials, portfolioUrl: a.portfolio_url ?? "",
    teachingExperience: a.teaching_experience, instagram: a.instagram_handle ?? "", programProposal: a.program_proposal,
    valueToParticipants: a.value_to_participants, preferredFormat: a.preferred_format, consent: a.consented_at ? "on" : "",
  };
}

function StatusTrack({ status }: { status: HostApplicationRow["status"] }) {
  const order = { draft: 0, revision_requested: 0, submitted: 1, reviewing: 2, approved: 3, rejected: 3 } as const;
  const at = order[status];
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="진행 단계">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex flex-col gap-2">
          <span className={`h-0.5 ${i <= at ? "bg-foreground" : "bg-border"}`} />
          <span className={`text-xs ${i === at ? "font-semibold" : "text-muted-foreground"}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function ApplyPage() {
  const member = await requireActiveMember("/become-a-host/apply");
  const host = await getMyHostProfile(member.id);
  if (host?.status === "approved" && member.roles.includes("host")) redirect("/host");
  const app = await getMyApplication(member.id);
  const editable = !app || app.status === "draft" || app.status === "revision_requested";
  const canReapply = app?.status === "rejected";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-8">
        <p className="eyebrow text-muted-foreground">Become a Host</p>
        <h1 className="mt-2 font-display text-3xl font-medium sm:text-4xl">호스트 지원서</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          입장료는 없어요. 운영팀이 경력과 기획안을 확인한 뒤 결과를 알려 드려요.{" "}
          <Link href="/become-a-host" className="underline underline-offset-4">호스트 정책 보기</Link>
        </p>

        {host?.status === "suspended" ? (
          <p className="mt-8 bg-notice px-4 py-3 text-sm text-notice-foreground">이용이 제한된 호스트 계정입니다. 운영팀에 문의해 주세요.</p>
        ) : (
          <div className="mt-8 flex flex-col gap-8">
            {app && (
              <section className="border p-5" data-testid="application-status" data-status={app.status}>
                <div className="flex items-center justify-between">
                  <p className="eyebrow text-muted-foreground">내 지원 상태</p>
                  <span className="text-sm font-semibold">{APPLICATION_STATUS_LABEL[app.status]}</span>
                </div>
                <div className="mt-4"><StatusTrack status={app.status} /></div>
                {app.status === "revision_requested" && app.review_note && (
                  <p className="mt-4 bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="revision-note">
                    <strong>운영팀 수정 요청:</strong> {app.review_note}
                  </p>
                )}
                {app.status === "rejected" && (
                  <p className="mt-4 text-sm text-muted-foreground" data-testid="reject-note">
                    {app.review_note ? `반려 사유: ${app.review_note}` : "이번 지원은 반려되었어요."} 내용을 보완해 새로 지원할 수 있어요.
                  </p>
                )}
                {(app.status === "submitted" || app.status === "reviewing") && (
                  <p className="mt-4 text-sm text-muted-foreground">심사 중이에요. 결과는 알림과 이 화면에서 확인할 수 있어요.</p>
                )}
              </section>
            )}

            {editable || canReapply ? (
              <ApplicationForm defaults={canReapply ? { ...toDefaults(app), consent: "" } : toDefaults(app)} />
            ) : (
              app && (
                <section className="flex flex-col gap-4 text-sm" data-testid="application-summary">
                  <p className="eyebrow text-muted-foreground">제출한 내용</p>
                  <dl className="flex flex-col">
                    {[
                      ["호스트 이름", app.display_name],
                      ["지원 분류", pillarInfo(app.pillar)?.label ?? "-"],
                      ["한 줄 소개", app.headline],
                      ["경력", app.career],
                      ["프로그램 기획안", app.program_proposal],
                      ["참가자에게 줄 가치", app.value_to_participants],
                    ].map(([k, val]) => (
                      <div key={k} className="border-b py-3">
                        <dt className="text-xs text-muted-foreground">{k}</dt>
                        <dd className="mt-1 whitespace-pre-line">{val}</dd>
                      </div>
                    ))}
                  </dl>
                  <Button asChild variant="outline" className="self-start"><Link href="/me">마이페이지로</Link></Button>
                </section>
              )
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
