"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

function subscribe(onTick: () => void) {
  const id = window.setInterval(onTick, 1000);
  return () => window.clearInterval(id);
}
const clientNow = () => Math.floor(Date.now() / 1000);
const serverNow = () => 0;

/**
 * 열림 시각까지 남은 시간 (일·시간·분·초). 실제 열림 시각 기준으로만 셈 — 꾸민 카운트다운 아님.
 * 시각이 되면 서버에 다시 물어 화면을 바꿈(열렸으면 신청 버튼이 켜짐). 시계가 조금 빨라도 서버가 열렸다고 할 때까지 몇 초마다 확인.
 * initialSeconds: 서버가 계산한 첫 화면 값(깜빡임 방지)
 */
export function OpensCountdown({ opensAt, initialSeconds, className }: { opensAt: string; initialSeconds: number; className?: string }) {
  const router = useRouter();
  const tick = useSyncExternalStore(subscribe, clientNow, serverNow);
  const remaining = tick === 0 ? initialSeconds : Math.max(0, Math.ceil(new Date(opensAt).getTime() / 1000) - tick);
  const done = remaining <= 0;
  useEffect(() => {
    if (!done) return;
    router.refresh();
    const id = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(id);
  }, [done, router]);

  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const cells: [number, string][] = d > 0 ? [[d, "일"], [h, "시간"], [m, "분"], [s, "초"]] : [[h, "시간"], [m, "분"], [s, "초"]];
  return (
    <div className={cn("flex gap-2", className)} role="timer" aria-label={`열리기까지 ${d}일 ${h}시간 ${m}분 ${s}초`} data-testid="opens-countdown">
      {cells.map(([n, unit]) => (
        <div key={unit} className="min-w-[4.25rem] flex-1 rounded-2xl border border-border bg-card px-2 py-2.5 text-center sm:flex-none">
          <b className="block font-num text-[28px] leading-none font-semibold" aria-hidden>{String(n).padStart(2, "0")}</b>
          <span aria-hidden className="mt-1 block text-[13px] text-muted-foreground">{unit}</span>
        </div>
      ))}
    </div>
  );
}
