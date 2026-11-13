"use client";

import Link from "next/link";
import { useActionState } from "react";

import { toggleFollowAction } from "@/app/hosts/[slug]/actions";
import { initialFormState } from "@/lib/forms";

/**
 * 호스트 팔로우 버튼. tone="dark": 어두운 배경(호스트 페이지), "light": 밝은 배경 작은 알약 버튼(프로그램 상세).
 * - 비로그인: 로그인 후 돌아오는 링크
 * - 본인: 표시하지 않음 (호출하는 쪽에서 처리)
 */
export function FollowButton({
  hostId,
  path,
  following,
  count,
  loggedIn,
  tone = "dark",
  showCount,
  stretch = false,
}: {
  hostId: string;
  path: string;
  following: boolean;
  count: number;
  loggedIn: boolean;
  tone?: "dark" | "light";
  /** 팔로워 수 표시 (기본: dark만) */
  showCount?: boolean;
  /** 줄 전체 폭을 채우는 큰 버튼 (호스트 명함) */
  stretch?: boolean;
}) {
  const [state, action, pending] = useActionState(toggleFollowAction, initialFormState);
  const light = tone === "light";
  const base = stretch
    ? "inline-flex h-11 w-full items-center justify-center rounded-full px-4 text-sm font-bold transition-colors disabled:opacity-60"
    : light
    ? "inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-60"
    : "inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-colors disabled:opacity-60";
  const on = light ? "border border-forest/30 text-forest hover:border-forest" : "border border-cream/40 text-cream hover:border-cream";
  const off = light ? "bg-forest text-white hover:bg-forest/90" : "bg-cream text-forest hover:bg-linen";
  const withCount = showCount ?? !light;
  return (
    <div className={stretch ? "flex flex-1 flex-col gap-1 [&>form]:w-full" : light && !withCount ? "flex flex-col items-end gap-1" : "flex flex-wrap items-center gap-3"} data-testid="follow">
      {loggedIn ? (
        <form action={action}>
          <input type="hidden" name="hostId" value={hostId} />
          <input type="hidden" name="path" value={path} />
          <input type="hidden" name="intent" value={following ? "unfollow" : "follow"} />
          <button
            type="submit"
            disabled={pending}
            aria-pressed={following}
            data-testid="follow-button"
            className={`${base} ${following ? on : off}`}
          >
            {pending ? "처리 중…" : following ? "팔로잉 ✓" : "팔로우"}
          </button>
        </form>
      ) : (
        <Link href={`/login?next=${encodeURIComponent(path)}`} className={`${base} ${off}`} data-testid="follow-login">
          {light ? "팔로우" : "로그인하고 팔로우"}
        </Link>
      )}
      {withCount && (
        <span className={`text-sm ${light ? "text-muted-foreground" : "text-linen"}`} data-testid="follower-count">
          팔로워 {count.toLocaleString("ko-KR")}명
        </span>
      )}
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"} className={stretch ? `text-center text-xs ${state.status === "error" ? "text-destructive" : "text-muted-foreground"}` : light && !withCount ? `max-w-48 text-right text-xs ${state.status === "error" ? "text-destructive" : "text-muted-foreground"}` : `w-full text-sm ${state.status === "error" ? (light ? "text-destructive" : "text-[#f0a08a]") : light ? "text-muted-foreground" : "text-linen"}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}
