"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="h-10 rounded-full bg-foreground px-5 text-sm font-semibold text-background print:hidden" data-testid="print-roster">
      인쇄하기
    </button>
  );
}
