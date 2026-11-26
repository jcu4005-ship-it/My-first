import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/forms/action-form";
import { StatusPill } from "@/components/forms/controls";
import { pillarInfo } from "@/config/pillars";
import { requireAdmin } from "@/lib/auth/guards";
import { countUpcomingActiveBookings, listHostHistory } from "@/lib/hosting/applications";
import { hostHref } from "@/lib/hosting/avatar";
import { listHostApplications } from "@/lib/hosting/queries";

import { setHostActiveAction, setHostSlugAction } from "../../../actions";
import { HostListingForm } from "../../listing-form";

export const metadata: Metadata = { title: "호스트 관리" };
export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACTION_LABEL: Record<string, string> = {
  "host_application.submit": "지원서 제출",
  "host_application.start_review": "심사 시작",
  "host_application.request_revision": "수정 요청",
  "host_application.approve": "승인",
  "host_application.reject": "반려",
  "host.listing_update": "분류·추천 변경",
  "host.slug_update": "주소 변경",
  "host.deactivate": "활동 중지",
  "host.reactivate": "활동 재개",
};

export default async function AdminHostProfilePage({ params }: PageProps<"/admin/hosts/profile/[userId]">) {
  const { userId } = await params;
  await requireAdmin(`/admin/hosts/profile/${userId}`);
  if (!UUID.test(userId)) notFound();
  const host = (await listHostApplications()).find((h) => h.user_id === userId);
  if (!host || (host.status !== "approved" && host.status !== "suspended")) notFound();
  const [history, upcoming] = await Promise.all([listHostHistory(userId), countUpcomingActiveBookings(userId)]);
  const active = host.status === "approved";

  return (
    <div className="max-w-3xl" data-testid="admin-host" data-status={host.status}>
      <Link href="/admin/hosts?tab=approved" className="text-sm text-muted-foreground">← 호스트 심사</Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">{host.display_name}</h1>
        <StatusPill tone={active ? "ok" : "warn"}>{active ? "활동 중" : "활동 중지"}</StatusPill>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {pillarInfo(host.primary_pillar)?.label ?? "분류 없음"} · {host.occupation || host.headline}
        {active && (
          <> · <Link href={hostHref(host)} className="underline underline-offset-4">공개 페이지</Link></>
        )}
      </p>

      <section className="mt-8 flex flex-col gap-3 border p-5">
        <p className="font-semibold">공개 주소</p>
        <p className="text-sm text-muted-foreground">
          지금 주소: <code data-testid="current-slug">/hosts/{host.slug ?? "(없음)"}</code>. 바꾸면 예전 주소로는 더 이상 연결되지 않아요.
        </p>
        <ActionForm action={setHostSlugAction} hidden={{ userId }} label="주소 바꾸기"
          note={{ name: "slug", placeholder: "새 주소 (영문 소문자·숫자·하이픈, 예: filmlog-dohyun)" }} testId="host-slug-form" />
      </section>

      {active && (
        <section className="mt-6 flex flex-col gap-3 border p-5">
          <p className="font-semibold">분류·추천</p>
          <HostListingForm userId={userId} pillar={host.primary_pillar} featured={host.is_featured} order={host.featured_order} />
        </section>
      )}

      <section className="mt-6 flex flex-col gap-3 border p-5" data-testid="host-status-section">
        <p className="font-semibold">{active ? "활동 중지" : "활동 재개"}</p>
        {active ? (
          <>
            <p className="text-sm text-muted-foreground">
              중지하면 호스트 페이지·프로그램·저널 글이 공개 화면에서 사라지고, 호스트는 새 프로그램을 만들 수 없어요. 프로그램과 글은 지워지지 않아 재개하면 다시 보여요.
            </p>
            {upcoming > 0 ? (
              <p className="bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="upcoming-bookings">
                예정된 참가 신청이 {upcoming}건 있어 지금은 중지할 수 없어요. 참가자 보호를 위해 일정 취소·환불을 먼저 정리해 주세요.
              </p>
            ) : (
              <ActionForm action={setHostActiveAction} hidden={{ userId, active: "false" }} label="활동 중지"
                note={{ name: "reason", placeholder: "중지 사유 (5자 이상, 호스트에게 알림으로 전달돼요)" }}
                confirmText="이 호스트의 활동을 중지할까요?" testId="deactivate-host" />
            )}
          </>
        ) : (
          <ActionForm action={setHostActiveAction} hidden={{ userId, active: "true" }} label="다시 활성화" variant="default"
            note={{ name: "reason", placeholder: "재개 사유 (5자 이상)" }} testId="reactivate-host" />
        )}
      </section>

      <section className="mt-8">
        <p className="mb-3 font-semibold">처리 이력</p>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">기록이 없어요.</p>
        ) : (
          <ol className="flex flex-col gap-2 text-sm" data-testid="host-history">
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
