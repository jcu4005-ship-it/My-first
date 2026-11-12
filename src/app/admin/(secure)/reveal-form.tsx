"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFormState, type FormState } from "@/lib/forms";

/**
 * 개인정보 원문 열람: 기본은 가린 값만 보이고, 사유를 적어야 원문이 보여요.
 * 원문은 이 화면에만 잠깐 나타나고(새로고침하면 사라짐), 열람 사실과 사유는 감사 기록에 남아요.
 */
export function RevealForm({
  action,
  targetId,
  masked,
  label,
  testId,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  targetId: string;
  masked: string;
  label: string;
  testId: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const revealed = state.status === "success" ? state.message : null;
  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <span className="font-mono text-sm" data-testid={`${testId}-value`}>{revealed ?? masked}</span>
      {!revealed && (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="targetId" value={targetId} />
          <Input name="reason" placeholder="열람 사유 (5자 이상, 기록에 남아요)" aria-label={`${label} 열람 사유`} className="h-9 max-w-xs text-sm" />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? "확인 중…" : `${label} 보기`}</Button>
        </form>
      )}
      {state.status === "error" && <p role="alert" className="text-xs text-destructive">{state.message}</p>}
      {revealed && <p className="text-xs text-muted-foreground">열람 기록이 남았어요. 새로고침하면 다시 가려져요.</p>}
    </div>
  );
}
