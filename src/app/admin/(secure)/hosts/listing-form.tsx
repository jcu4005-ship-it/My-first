"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { PILLARS } from "@/config/pillars";
import { initialFormState } from "@/lib/forms";

import { updateHostListingAction } from "../actions";

/** 승인된 호스트의 대표 분류·운영팀 추천 지정 */
export function HostListingForm({
  userId,
  pillar,
  featured,
  order,
}: {
  userId: string;
  pillar: string | null;
  featured: boolean;
  order: number | null;
}) {
  const [state, action, pending] = useActionState(updateHostListingAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3" data-testid="host-listing-form">
      <input type="hidden" name="userId" value={userId} />
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        대표 분류
        <select name="pillar" defaultValue={pillar ?? ""} className="h-9 rounded-[2px] border bg-white px-2 text-sm text-foreground" required>
          <option value="" disabled>선택</option>
          {PILLARS.map((p) => (
            <option key={p.slug} value={p.slug}>{p.label} · {p.ko}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" name="featured" defaultChecked={featured} className="size-4" />
        추천
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        추천 순서
        <input name="order" type="number" min={1} max={99} defaultValue={order ?? ""} className="h-9 w-20 rounded-[2px] border bg-white px-2 text-sm text-foreground" />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? "저장 중…" : "저장"}</Button>
      <FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} />
    </form>
  );
}
