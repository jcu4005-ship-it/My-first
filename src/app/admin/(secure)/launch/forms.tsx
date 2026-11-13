"use client";

import { SelectField } from "@/components/forms/controls";
import { Field, FormMessage } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";

import { createInviteCodeAction, updateAppSettingsAction } from "../actions";

/** 서비스 설정 변경 (초대제·유료 신청) — 사유 필수 */
export function SettingsForm({ inviteOnly, paidBookings }: { inviteOnly: boolean; paidBookings: boolean }) {
  const [state, action, pending, version] = useFormAction(updateAppSettingsAction);
  const e = state.fieldErrors ?? {};
  const v = state.status === "error" ? (state.values ?? {}) : {};
  return (
    <form key={version} action={action} className="grid gap-4 sm:grid-cols-2" data-testid="settings-form" noValidate>
      <div className="sm:col-span-2"><FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} /></div>
      <SelectField name="inviteOnly" label="가입 방식" defaultValue={v.inviteOnly ?? String(inviteOnly)}
        options={[{ value: "true", label: "초대 코드가 있어야 가입 (비공개 베타)" }, { value: "false", label: "누구나 가입 (공개)" }]} />
      <SelectField name="paidBookings" label="유료 프로그램 신청" defaultValue={v.paidBookings ?? String(paidBookings)}
        options={[{ value: "false", label: "막기 (무료 프로그램만)" }, { value: "true", label: "허용 (결제 연결 후에만)" }]} />
      <div className="sm:col-span-2">
        <Field name="reason" label="변경 사유" defaultValue={v.reason} error={e.reason} hint="감사 기록에 남아요. 예: 지인 대상 비공개 베타 시작" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "저장 중…" : "설정 저장"}</Button>
      </div>
    </form>
  );
}

/** 초대 코드 발급 */
export function InviteForm() {
  const [state, action, pending, version] = useFormAction(createInviteCodeAction);
  const e = state.fieldErrors ?? {};
  const v = state.status === "error" ? (state.values ?? {}) : {};
  return (
    <form key={version} action={action} className="grid gap-4 sm:grid-cols-2" data-testid="invite-form" noValidate>
      <div className="sm:col-span-2"><FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} /></div>
      <Field name="code" label="초대 코드" defaultValue={v.code} error={e.code} hint="영문 대문자·숫자·하이픈 5~20자, 예: FRIENDS-01" />
      <Field name="note" label="메모 (선택)" defaultValue={v.note} error={e.note} hint="누구에게 줬는지 (운영팀만 봐요)" />
      <Field name="maxUses" label="사용 가능 횟수" inputMode="numeric" defaultValue={v.maxUses ?? "10"} error={e.maxUses} hint="이 코드로 가입할 수 있는 사람 수" />
      <Field name="expiresOn" label="마지막 사용일 (선택)" type="date" defaultValue={v.expiresOn} error={e.expiresOn} />
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "만드는 중…" : "초대 코드 만들기"}</Button>
      </div>
    </form>
  );
}
