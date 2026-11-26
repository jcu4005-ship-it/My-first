"use client";

import { FormMessage } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { replySupportAction } from "../../actions";

export function AdminReplyForm({ ticketId }: { ticketId: string }) {
  const [state, action, pending, version] = useFormAction(replySupportAction);
  const e = state.fieldErrors ?? {};
  return (
    <form key={version} action={action} className="flex flex-col gap-3" data-testid="admin-reply-form" noValidate>
      <FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} />
      <input type="hidden" name="ticketId" value={ticketId} />
      <Label htmlFor="admin-reply">답변</Label>
      <Textarea id="admin-reply" name="body" rows={6} maxLength={2000} defaultValue={state.status === "error" ? state.values?.body : ""} aria-invalid={e.body ? true : undefined} />
      {e.body && <p className="text-xs text-destructive" role="alert">{e.body}</p>}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="close" className="size-4" />
        답변하면서 해결됨으로 처리
      </label>
      <Button type="submit" disabled={pending} className="self-start">{pending ? "보내는 중…" : "답변 보내기"}</Button>
    </form>
  );
}
