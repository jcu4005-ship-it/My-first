"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { initialFormState } from "@/lib/forms";

import { payTestAction } from "../actions";

export function PayForm({ bookingId, amount }: { bookingId: string; amount: number }) {
  const [state, action, pending] = useActionState(payTestAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <FormMessage message={state.message} />
      <Button type="submit" size="lg" disabled={pending} data-testid="pay-test">
        {pending ? "결제 중…" : `${formatPrice(amount)} 테스트 결제하기`}
      </Button>
    </form>
  );
}
