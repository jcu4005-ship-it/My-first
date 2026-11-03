import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** 라벨 + 입력 + 오류 문구 묶음 */
export function Field({
  name,
  label,
  error,
  hint,
  ...inputProps
}: { name: string; label: string; error?: string; hint?: string } & React.ComponentProps<"input">) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined}
        {...inputProps}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormMessage({ message, tone = "error" }: { message?: string; tone?: "error" | "success" }) {
  if (!message) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      data-testid={tone === "error" ? "form-error" : "form-success"}
      className={
        tone === "error"
          ? "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-lg bg-notice px-3 py-2 text-sm text-notice-foreground"
      }
    >
      {message}
    </p>
  );
}
