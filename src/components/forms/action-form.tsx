"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";

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
  const formRef = useRef<HTMLFormElement>(null);
  // 성공하면 입력칸을 비우고, 오류면 쓴 내용을 그대로 둠
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);
  return (
    <form
      ref={formRef}
      action={formAction}
      data-testid={testId}
      className={cn("flex flex-col gap-2", className)}
      onSubmit={(e) => {
        // 화면 준비 후에는 직접 제출(기본 제출은 입력을 비움). 준비 전에는 기본 제출(action)로 동작
        e.preventDefault();
        if (confirmText && !window.confirm(confirmText)) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
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
