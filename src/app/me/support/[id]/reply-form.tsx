"use client";

import { FormMessage } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { addSupportMessageAction } from "@/app/help/actions";

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const [state, action, pending, version] = useFormAction(addSupportMessageAction);
  const e = state.fieldErrors ?? {};
  return (
    <form key={version} action={action} className="flex flex-col gap-3" data-testid="support-reply-form" noValidate>
      <FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} />
      <input type="hidden" name="ticketId" value={ticketId} />
      <Label htmlFor="reply-body">이어서 적기</Label>
      <Textarea id="reply-body" name="body" rows={4} maxLength={2000} defaultValue={state.status === "error" ? state.values?.body : ""} aria-invalid={e.body ? true : undefined} />
      {e.body && <p className="text-xs text-destructive" role="alert">{e.body}</p>}
      <Button type="submit" disabled={pending} className="self-end">{pending ? "보내는 중…" : "보내기"}</Button>
    </form>
  );
}
