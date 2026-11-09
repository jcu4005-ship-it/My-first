import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { requireActiveMember } from "@/lib/auth/guards";
import { hostHref } from "@/lib/hosting/avatar";
import { getMyHostProfile } from "@/lib/hosting/queries";

import { HostProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "프로필 관리" };
export const instant = false;

export default async function HostProfilePage() {
  const member = await requireActiveMember("/host/profile");
  const host = await getMyHostProfile(member.id);
  if (!host || host.status !== "approved" || !member.roles.includes("host")) redirect("/host/apply");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-8">
        <Link href="/host" className="text-sm text-muted-foreground">← 호스트 홈</Link>
        <p className="eyebrow mt-6 text-muted-foreground">Host Profile</p>
        <h1 className="mt-2 font-display text-3xl font-medium">프로필 관리</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          공개 호스트 페이지(<Link href={hostHref(host)} className="underline underline-offset-4">{hostHref(host)}</Link>)에 보이는 내용이에요.
          주소와 추천 여부는 운영팀이 관리해요.
        </p>
        <div className="mt-8">
          <HostProfileForm
            userId={member.id}
            avatarPath={host.avatar_path}
            defaults={{
              displayName: host.display_name,
              occupation: host.occupation,
              headline: host.headline,
              bio: host.bio,
              philosophy: host.philosophy,
              career: host.career,
              credentials: host.credentials,
              teachingExperience: host.teaching_experience,
              portfolioUrl: host.portfolio_url ?? "",
              expertise: host.expertise.join(", "),
              instagram: host.instagram_handle ?? "",
            }}
          />
        </div>
      </main>
    </>
  );
}
