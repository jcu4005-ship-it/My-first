"use client";

import { SelectField } from "@/components/forms/controls";
import { Field, FormMessage } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUPPORT_CATEGORIES } from "@/lib/support/types";

import { createTicketAction } from "../actions";

export function ContactForm({ bookings, defaultCategory }: { bookings: { id: string; label: string }[]; defaultCategory?: string }) {
  const [state, action, pending, version] = useFormAction(createTicketAction);
  const e = state.fieldErrors ?? {};
  const v = state.status === "error" ? (state.values ?? {}) : {};
  return (
    <form key={version} action={action} className="flex flex-col gap-5" data-testid="contact-form" noValidate>
      <FormMessage message={state.message} />
      <SelectField name="category" label="문의 분야" defaultValue={v.category ?? defaultCategory ?? "booking"}
        options={SUPPORT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} error={e.category} />
      {bookings.length > 0 && (
        <SelectField name="bookingId" label="관련 신청 (선택)" defaultValue={v.bookingId ?? ""}
          options={[{ value: "", label: "선택 안 함" }, ...bookings.map((b) => ({ value: b.id, label: b.label }))]} />
      )}
      <Field name="subject" label="제목" defaultValue={v.subject} error={e.subject} maxLength={80} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="body">내용</Label>
        <Textarea id="body" name="body" rows={7} maxLength={2000} defaultValue={v.body} aria-invalid={e.body ? true : undefined}
          placeholder="언제, 어떤 프로그램에서, 무슨 일이 있었는지 적어 주시면 더 빨리 도와드릴 수 있어요." />
        {e.body && <p className="text-xs text-destructive" role="alert">{e.body}</p>}
        <p className="text-xs text-muted-foreground">비밀번호·카드 번호 같은 민감한 정보는 적지 마세요. 문의 내용은 본인과 운영팀만 볼 수 있어요.</p>
      </div>
      <Button type="submit" size="lg" disabled={pending}>{pending ? "보내는 중…" : "문의 보내기"}</Button>
    </form>
  );
}
