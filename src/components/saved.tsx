"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import { syncSavesAction, toggleSaveAction } from "@/app/saved/actions";

import { cn } from "@/lib/utils";

/**
 * 저장한 프로그램 — 이 브라우저에만 저장(localStorage). 서버·DB로 보내지 않습니다.
 * (로그인 없이도 쓰는 가벼운 찜. 다른 기기와는 공유되지 않음을 화면에서 알려 줍니다.)
 * 저장이 막힌 브라우저(사생활 보호 모드 등)에서는 조용히 건너뜁니다.
 */
export type SavedItem = { id: string; title: string; meta: string };

const KEY = "roundi:saved-programs";
const EVENT = "roundi:saved-programs";
const MAX = 60;
const ID = /^[0-9a-f-]{36}$/;

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): SavedItem[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list)
      ? list
          .filter((x): x is SavedItem => x && typeof x.id === "string" && ID.test(x.id) && typeof x.title === "string" && typeof x.meta === "string")
          .slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

function write(list: SavedItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // 저장할 수 없는 브라우저 — 무시
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

function useSaved() {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => parse(raw), [raw]);
}

/** 카드·상세에 얹는 저장 버튼. 카드 링크 안에 있어도 링크로 이동하지 않음. */
export function SaveButton({ item, className, tone = "light" }: { item: SavedItem; className?: string; tone?: "light" | "dark" }) {
  const saved = useSaved().some((x) => x.id === item.id);
  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const list = parse(read());
    write(saved ? list.filter((x) => x.id !== item.id) : [item, ...list.filter((x) => x.id !== item.id)]);
    // 로그인했으면 계정에도 저장 (실패해도 이 기기 목록은 그대로)
    void toggleSaveAction(item.id, !saved).catch(() => undefined);
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? `${item.title} 저장 취소` : `${item.title} 저장하기`}
      data-testid="save-button"
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full backdrop-blur transition-colors",
        tone === "light" ? "bg-white/85 text-forest hover:bg-white" : "bg-black/25 text-white hover:bg-black/40",
        className,
      )}
    >
      <Bookmark aria-hidden className="size-[17px]" strokeWidth={1.8} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}

/**
 * 로그인한 회원: 탭을 열 때 한 번, 이 기기의 저장을 계정에 올리고 계정 목록으로 맞춤
 * (다른 기기에서 저장한 것도 여기 북마크에 표시됨)
 */
export function SavesSync() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(EVENT + ":synced")) return;
      window.sessionStorage.setItem(EVENT + ":synced", "1");
    } catch {
      // 저장소를 못 쓰는 브라우저면 매번 맞춤
    }
    const local = parse(read());
    syncSavesAction(local.map((x) => x.id))
      .then((remote) => {
        if (!remote) return;
        const ids = new Set(remote.map((x) => x.id));
        write([...remote, ...local.filter((x) => !ids.has(x.id))]);
      })
      .catch(() => undefined);
  }, []);
  return null;
}

/** 저장 화면 목록 */
export function SavedList() {
  const items = useSaved();
  if (!items.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-border bg-card/60 px-6 py-14 text-center" data-testid="saved-empty">
        <Bookmark aria-hidden className="mx-auto size-7 text-sage" strokeWidth={1.5} />
        <p className="mt-3 font-semibold">아직 저장한 프로그램이 없어요</p>
        <p className="mt-1 text-sm text-muted-foreground">마음에 드는 프로그램의 북마크를 누르면 여기에 모여요.</p>
        <Link href="/meetups" className="mt-4 inline-block text-sm font-semibold text-forest underline-offset-4 hover:underline">
          프로그램 둘러보기
        </Link>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-[20px] bg-card" data-testid="saved-list">
      {items.map((x) => (
        <li key={x.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
          <Link href={`/meetups/${x.id}`} className="min-w-0 flex-1">
            <span className="block truncate font-semibold hover:underline hover:underline-offset-4">{x.title}</span>
            <span className="block truncate text-[12.5px] text-muted-foreground">{x.meta}</span>
          </Link>
          <SaveButton item={x} tone="light" className="border border-border" />
        </li>
      ))}
    </ul>
  );
}
