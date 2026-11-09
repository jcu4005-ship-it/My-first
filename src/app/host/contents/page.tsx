import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusPill } from "@/components/forms/controls";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { requireActiveMember } from "@/lib/auth/guards";
import { listMyContents } from "@/lib/contents/queries";
import { CONTENT_STATUS_LABEL, CONTENT_STATUS_TONE, contentTypeInfo } from "@/lib/contents/types";
import { formatShortDateTime } from "@/lib/format";
import { getMyHostProfile } from "@/lib/hosting/queries";

export const metadata: Metadata = { title: "내 콘텐츠" };
export const instant = false;

export default async function HostContentsPage() {
  const member = await requireActiveMember("/host/contents");
  const host = await getMyHostProfile(member.id);
  if (!host || host.status !== "approved" || !member.roles.includes("host")) redirect("/become-a-host/apply");
  const contents = await listMyContents(member.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8" data-testid="host-contents">
        <Link href="/host" className="text-sm text-muted-foreground underline underline-offset-4">← 호스트 공간</Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-muted-foreground">Journal</p>
            <h1 className="mt-1 font-display text-3xl font-medium">내 콘텐츠</h1>
            <p className="mt-2 text-sm text-muted-foreground">작업기·노하우·포트폴리오를 쓰면 운영팀 검토 뒤 저널과 호스트 페이지에 공개돼요.</p>
          </div>
          <Button asChild>
            <Link href="/host/contents/new">새 글 쓰기</Link>
          </Button>
        </div>

        {contents.length === 0 ? (
          <div className="mt-8 border border-dashed p-10 text-center">
            <p className="font-semibold">아직 쓴 글이 없어요</p>
            <p className="mt-2 text-sm text-muted-foreground">프로그램 준비 과정이나 작업 이야기를 짧게라도 남겨 보세요. 참가자가 호스트를 알아 가는 가장 좋은 방법이에요.</p>
          </div>
        ) : (
          <ul className="mt-8 flex flex-col gap-3">
            {contents.map((c) => (
              <li key={c.id}>
                <Link href={`/host/contents/${c.id}`} className="flex flex-col gap-2 border p-5 transition-colors hover:border-foreground" data-testid="my-content-row" data-title={c.title}>
                  <div className="flex items-center gap-2">
                    <StatusPill tone={CONTENT_STATUS_TONE[c.status]}>{CONTENT_STATUS_LABEL[c.status]}</StatusPill>
                    <span className="text-xs text-muted-foreground">{contentTypeInfo(c.type)?.ko}</span>
                  </div>
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-xs text-muted-foreground">마지막 수정 {formatShortDateTime(c.updated_at)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
