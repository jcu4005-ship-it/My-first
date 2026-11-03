"use client";

import { useActionState } from "react";

import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/forms";

import { addSessionAction, updateCapacityAction } from "../../actions";

export function AddSessionForm({ meetupId }: { meetupId: string }) {
  const [state, action, pending] = useActionState(addSessionAction, initialFormState);
  const e = state.fieldErrors ?? {};
  const v = state.status === "success" ? {} : (state.values ?? {});
  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border p-5" noValidate data-testid="add-session-form" key={state.status === "success" ? state.message : "form"}>
      <input type="hidden" name="meetupId" value={meetupId} />
      <p className="font-semibold">일정 추가</p>
      <FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="date" label="날짜" type="date" defaultValue={v.date} error={e.date} />
        <Field name="startTime" label="시작" type="time" defaultValue={v.startTime} error={e.startTime} />
        <Field name="endTime" label="종료" type="time" defaultValue={v.endTime} error={e.endTime} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="area" label="동네 (공개)" placeholder="성수동" defaultValue={v.area} error={e.area} />
        <Field name="venueName" label="장소 이름 (공개)" placeholder="카페 레이어드 2층" defaultValue={v.venueName} error={e.venueName} />
      </div>
      <Field name="addressDetail" label="상세 주소 (확정 참가자에게만 공개)" defaultValue={v.addressDetail} error={e.addressDetail} />
      <Field name="capacity" label="정원 (명)" inputMode="numeric" defaultValue={v.capacity ?? "8"} error={e.capacity} className="max-w-32" />
      <Button type="submit" disabled={pending} className="self-start">{pending ? "추가 중…" : "일정 추가"}</Button>
    </form>
  );
}

export function CapacityForm({ meetupId, sessionId, capacity }: { meetupId: string; sessionId: string; capacity: number }) {
  const [state, action, pending] = useActionState(updateCapacityAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="meetupId" value={meetupId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <Input name="capacity" defaultValue={capacity} inputMode="numeric" aria-label="정원" className="h-9 w-20" />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>정원 변경</Button>
      {state.message && (
        <span className={state.status === "success" ? "text-xs text-muted-foreground" : "text-xs text-destructive"} role="status">
          {state.message}
        </span>
      )}
    </form>
  );
}
