import type { Metadata } from "next";

import { ActionForm } from "@/components/forms/action-form";
import { StatusPill } from "@/components/forms/controls";
import { requireAdmin } from "@/lib/auth/guards";
import { formatYmd } from "@/lib/format";
import { getAppSettings, listInviteCodes } from "@/lib/settings/queries";

import { setInviteActiveAction } from "../actions";

import { InviteForm, SettingsForm } from "./forms";

export const metadata: Metadata = { title: "운영 설정" };
export const instant = false;

export default async function AdminLaunchPage() {
  await requireAdmin("/admin/launch");
  const [settings, invites] = await Promise.all([getAppSettings(), listInviteCodes()]);
  const beta = settings.invite_only || !settings.paid_bookings_enabled;
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-display text-3xl font-bold">운영 설정</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          비공개 베타 동안에는 초대 코드가 있어야 가입할 수 있고, 유료 프로그램 신청은 막혀 있어요. 실제 결제(PG)가 연결되기 전에는 유료 신청을 허용하지 마세요.
        </p>
        <p className="mt-3 flex flex-wrap gap-2" data-testid="settings-state">
          <StatusPill tone={beta ? "warn" : "ok"}>{beta ? "비공개 베타" : "공개 운영"}</StatusPill>
          <StatusPill tone="muted">{settings.invite_only ? "초대제 가입" : "누구나 가입"}</StatusPill>
          <StatusPill tone="muted">{settings.paid_bookings_enabled ? "유료 신청 허용" : "무료 프로그램만"}</StatusPill>
        </p>
      </div>

      <section className="rounded-2xl border bg-card p-5" aria-labelledby="settings-title">
        <h2 id="settings-title" className="mb-4 text-lg font-bold">서비스 설정</h2>
        <SettingsForm inviteOnly={settings.invite_only} paidBookings={settings.paid_bookings_enabled} />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="invite-title">
        <h2 id="invite-title" className="text-lg font-bold">초대 코드</h2>
        <div className="rounded-2xl border bg-card p-5">
          <InviteForm />
        </div>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="empty-state">아직 만든 초대 코드가 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {invites.map((c) => {
              const expired = c.expires_at ? new Date(c.expires_at).getTime() <= Date.parse(new Date().toISOString()) : false;
              const usable = c.is_active && !expired && c.used_count < c.max_uses;
              return (
                <li key={c.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="invite-row" data-code={c.code}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold">{c.code}</span>
                      <StatusPill tone={usable ? "ok" : "muted"}>{usable ? "사용 가능" : !c.is_active ? "꺼짐" : expired ? "만료" : "다 씀"}</StatusPill>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground" data-testid="invite-usage">
                      가입 {c.used_count} / {c.max_uses}명{c.note ? ` · ${c.note}` : ""} · {formatYmd(c.created_at)} 발급
                      {c.expires_at ? ` · ${formatYmd(new Date(new Date(c.expires_at).getTime() - 1).toISOString())}까지` : ""}
                    </p>
                  </div>
                  <ActionForm action={setInviteActiveAction} hidden={{ inviteId: c.id, active: c.is_active ? "false" : "true" }}
                    label={c.is_active ? "끄기" : "다시 켜기"} testId="invite-toggle" />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
