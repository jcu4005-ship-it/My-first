"use client";

import { CalendarPlus, Link2, Share2 } from "lucide-react";
import { useState } from "react";

/**
 * 공유하기 · 캘린더에 추가.
 * 휴대폰은 기기 공유 창(카카오톡 등)을, 지원하지 않는 브라우저는 주소 복사를 씁니다.
 */
export function ShareBar({ title, path, calendarHref }: { title: string; path: string; calendarHref?: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      return; // 공유 창을 닫은 경우
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("이 주소를 복사해 주세요", url);
    }
  }
  const btn = "inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[13px] font-semibold hover:border-foreground";
  return (
    <div className="mt-3 flex flex-wrap gap-2" data-testid="share-bar">
      <button type="button" onClick={share} className={btn} data-testid="share-button">
        {copied ? <Link2 aria-hidden className="size-4" strokeWidth={1.8} /> : <Share2 aria-hidden className="size-4" strokeWidth={1.8} />}
        {copied ? "주소를 복사했어요" : "공유하기"}
      </button>
      {calendarHref && (
        <a href={calendarHref} className={btn} data-testid="calendar-link">
          <CalendarPlus aria-hidden className="size-4" strokeWidth={1.8} />
          캘린더에 추가
        </a>
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "주소를 복사했어요" : ""}
      </span>
    </div>
  );
}
