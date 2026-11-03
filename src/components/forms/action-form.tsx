"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFormState, type FormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** 버튼 하나(+선택적 사유 입력)로 서버 처리를 실행하는 작은 폼 */
export function ActionForm({
  action,
  hidden,
  label,
  variant = "outline",
  size = "sm",
  note,
  confirmText,
  testId,
  className,
}: {
  action: Action;
  hidden: Record<string, string>;
  label: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default" | "lg";
  note?: { name: string; placeholder: string };
  confirmText?: string;
  testId?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form
      action={formAction}
      data-testid={testId}
      className={cn("flex flex-col gap-2", className)}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {note && <Input name={note.name} placeholder={note.placeholder} aria-label={note.placeholder} />}
      <Button type="submit" variant={variant} size={size} disabled={pending} className="self-start">
        {pending ? "처리 중…" : label}
      </Button>
      <FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} />
    </form>
  );
}
