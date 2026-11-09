import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ContentForm } from "@/components/contents/content-form";
import { SiteHeader } from "@/components/site-header";
import { requireActiveMember } from "@/lib/auth/guards";
import { contentDefaults, listLinkableMeetups } from "@/lib/contents/queries";
import { getMyHostProfile } from "@/lib/hosting/queries";

export const metadata: Metadata = { title: "새 콘텐츠" };
export const instant = false;

export default async function NewHostContentPage() {
  const member = await requireActiveMember("/host/contents/new");
  const host = await getMyHostProfile(member.id);
  if (!host || host.status !== "approved" || !member.roles.includes("host")) redirect("/become-a-host/apply");
  const meetups = await listLinkableMeetups(member.id);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-8">
        <Link href="/host/contents" className="text-sm text-muted-foreground underline underline-offset-4">← 내 콘텐츠</Link>
        <h1 className="mt-4 mb-8 font-display text-3xl font-medium">새 글 쓰기</h1>
        <ContentForm scope="host" userId={member.id} defaults={contentDefaults(null)} meetups={meetups} />
      </main>
    </>
  );
}
