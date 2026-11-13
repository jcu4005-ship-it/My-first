"use client";

import Link from "next/link";
import { useEffect, useMemo, useSyncExternalStore } from "react";

/**
 * 최근 본 프로그램·글 — 이 브라우저에만 저장(localStorage). 서버·DB로 보내지 않습니다.
 * 저장이 막힌 브라우저(사생활 보호 모드 등)에서는 조용히 건너뜁니다.
 */
export type RecentItem = { kind: "program" | "content"; href: string; title: string };

const KEY = "gathering:recently-viewed";
const MAX = 8;
const EVENT = "gathering:recently-viewed";

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): RecentItem[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list)
      ? list.filter((x): x is RecentItem => x && typeof x.href === "string" && x.href.startsWith("/") && typeof x.title === "string").slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** 상세 화면에 넣으면 방문 기록을 남김 */
export function RecordRecentlyViewed({ item }: { item: RecentItem }) {
  const { kind, href, title } = item;
  useEffect(() => {
    try {
      const next = [{ kind, href, title }, ...parse(read()).filter((x) => x.href !== href)].slice(0, MAX);
      window.localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // 저장할 수 없는 브라우저 — 기록하지 않음
    }
  }, [kind, href, title]);
  return null;
}

export function RecentlyViewedList() {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const items = useMemo(() => parse(raw), [raw]);

  function clear() {
    try {
      window.localStorage.removeItem(KEY);
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // 무시
    }
  }

  return (
    <section data-testid="recently-viewed">
      <div className="mb-2.5 flex items-end justify-between px-1">
        <h2 className="font-display text-[19px] font-bold">최근 본 것</h2>
        {items.length > 0 && (
          <button type="button" onClick={clear} className="text-[13px] text-muted-foreground hover:text-foreground">
            기록 지우기
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="rounded-[18px] border-[1.5px] border-dashed border-[#cfc6b5] bg-card/60 px-5 py-5 text-sm text-muted-foreground">아직 본 프로그램이나 글이 없어요. 기록은 이 기기의 브라우저에만 저장돼요.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-dashed divide-[#ddd3c2] rounded-[20px] bg-card px-4 text-sm shadow-[0_2px_0_rgb(80_55_25/0.08),0_14px_24px_-14px_rgb(80_55_25/0.4)]">
          {items.map((x) => (
            <li key={x.href} className="flex items-center justify-between gap-3 py-3.5" data-testid="recent-item">
              <Link href={x.href} className="min-w-0 truncate hover:underline">{x.title}</Link>
              <span className="shrink-0 text-xs text-muted-foreground">{x.kind === "program" ? "테이블" : "저널"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
