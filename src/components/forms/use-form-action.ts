"use client";

import { useActionState } from "react";

import { initialFormState, type FormState } from "@/lib/forms";

type Versioned = FormState & { version?: number };

/**
 * useActionState + 결과마다 바뀌는 version.
 * React 19는 제출 뒤 폼을 초기화하는데, <select defaultValue>는 다시 채워지지 않아
 * 오류가 난 뒤 선택값이 사라진다. <form key={version}>로 다시 그려 입력값을 그대로 보여 준다.
 */
export function useFormAction(fn: (prev: FormState, formData: FormData) => Promise<FormState>) {
  const [state, action, pending] = useActionState<Versioned, FormData>(
    async (prev, formData) => ({ ...(await fn(prev, formData)), version: (prev.version ?? 0) + 1 }),
    initialFormState,
  );
  return [state, action, pending, state.version ?? 0] as const;
}
