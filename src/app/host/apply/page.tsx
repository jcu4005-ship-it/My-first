import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusPill } from "@/components/forms/controls";
import { SiteHeader } from "@/components/site-header";
import { requireActiveMember } from "@/lib/auth/guards";
import { getMyHostProfile } from "@/lib/hosting/queries";

import { ApplyForm } from "./apply-form";

export const metadata: Metadata = { title: "호스트 신청" };
export const instant = false;

export default async function HostApplyPage() {
  const member = await requireActiveMember("/host/apply");
  const host = await getMyHostProfile(member.id);
  if (host?.status === "approved" && member.roles.includes("host")) redirect("/host");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        <p className="text-xs tracking-[0.25em] text-accent">BECOME A HOST</p>
        <h1 className="mt-2 font-display text-3xl font-bold">호스트 신청</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          가르칠 수 있는 전문성을 프로그램으로 만들어 보세요. 운영팀이 경력과 포트폴리오를 확인한 뒤 승인하면 바로 프로그램을 만들 수 있어요.
        </p>

        <div className="mt-8">
          {host?.status === "applied" && (
            <div className="rounded-2xl border p-5" data-testid="host-apply-status">
              <StatusPill tone="warn">검토 중</StatusPill>
              <p className="mt-3 font-semibold">{host.display_name}</p>
              <p className="mt-1 text-sm text-muted-foreground">신청을 검토하고 있어요. 결과는 이 화면에서 확인할 수 있어요.</p>
            </div>
          )}
          {host?.status === "suspended" && (
            <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">이용이 제한된 호스트 계정입니다. 운영팀에 문의해 주세요.</p>
          )}
          {(!host || host.status === "rejected") && (
            <>
              {host?.status === "rejected" && (
                <div className="mb-6 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground">
                  이전 신청이 반려되었어요{host.review_note ? `: ${host.review_note}` : "."} 내용을 보완해 다시 신청할 수 있어요.
                </div>
              )}
              <ApplyForm
                defaults={host ? { displayName: host.display_name, headline: host.headline, bio: host.bio, expertise: host.expertise.join(", "), instagram: host.instagram_handle ?? "", career: host.career, credentials: host.credentials, portfolioUrl: host.portfolio_url ?? "", teachingExperience: host.teaching_experience } : undefined}
              />
            </>
          )}
        </div>
        <p className="mt-8 text-sm">
          <Link href="/for-hosts" className="underline underline-offset-4">호스트 정책(수수료·심사·정산) 먼저 보기</Link>
        </p>
        <p className="mt-4 text-sm">
          <Link href="/me" className="text-muted-foreground underline underline-offset-4">마이페이지로</Link>
        </p>
      </main>
    </>
  );
}
