import * as React from "react";

import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SelectField({
  name,
  label,
  options,
  defaultValue,
  error,
  className,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  error?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        className="h-11 rounded-xl border border-border bg-white px-3 text-base sm:text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}

export function TextareaField({
  name,
  label,
  error,
  hint,
  ...props
}: { name: string; label: string; error?: string; hint?: string } & React.ComponentProps<"textarea">) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} aria-invalid={error ? true : undefined} {...props} />
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}

export function StatusPill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" | "ok" | "warn" }) {
  const tones = {
    muted: "bg-secondary text-secondary-foreground",
    accent: "bg-accent text-accent-foreground",
    ok: "bg-forest text-white",
    warn: "bg-[#f6e7d9] text-clay",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])} data-testid="status-pill">
      {children}
    </span>
  );
}
