"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/forms";

import { setRoleAction, setStatusAction } from "../actions";

const selectClass = "h-9 rounded-lg border border-border bg-background px-2 text-sm";

export function MemberActions({ userId, roles, status }: { userId: string; roles: string[]; status: string }) {
  const [roleState, roleAction, rolePending] = useActionState(setRoleAction, initialFormState);
  const [statusState, statusAction, statusPending] = useActionState(setStatusAction, initialFormState);
  const isHost = roles.includes("host");
  const isAdmin = roles.includes("admin");

  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted-foreground">관리</summary>
      <div className="mt-3 flex flex-col gap-5">
        <form action={roleAction} className="flex flex-col gap-2" data-testid="role-form">
          <input type="hidden" name="userId" value={userId} />
          <FormMessage
            message={roleState.message ?? roleState.fieldErrors?.reason}
            tone={roleState.status === "success" ? "success" : "error"}
          />
          <select name="op" aria-label="역할 변경" className={selectClass} defaultValue="">
            <option value="" disabled>역할 변경 선택</option>
            <option value={isHost ? "host:revoke" : "host:grant"}>{isHost ? "호스트 회수" : "호스트 부여"}</option>
            <option value={isAdmin ? "admin:revoke" : "admin:grant"}>{isAdmin ? "관리자 회수" : "관리자 부여"}</option>
          </select>
          <Input name="reason" placeholder="사유 (5자 이상, 감사 기록에 남음)" aria-label="역할 변경 사유" />
          <Button type="submit" size="sm" variant="outline" disabled={rolePending} className="self-start">
            역할 변경
          </Button>
        </form>
        <form action={statusAction} className="flex flex-col gap-2" data-testid="status-form">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="status" value={status === "active" ? "suspended" : "active"} />
          <FormMessage
            message={statusState.message ?? statusState.fieldErrors?.reason}
            tone={statusState.status === "success" ? "success" : "error"}
          />
          <Input name="reason" placeholder="사유 (5자 이상)" aria-label="상태 변경 사유" />
          <Button type="submit" size="sm" variant="ghost" disabled={statusPending} className="self-start">
            {status === "active" ? "이용 정지" : "정지 해제"}
          </Button>
        </form>
      </div>
    </details>
  );
}
