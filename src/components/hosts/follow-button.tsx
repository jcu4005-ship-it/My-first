"use client";

import Link from "next/link";
import { useActionState } from "react";

import { toggleFollowAction } from "@/app/hosts/[slug]/actions";
import { initialFormState } from "@/lib/forms";

/**
 * 호스트 팔로우 버튼 (어두운 배경용).
 * - 비로그인: 로그인 후 돌아오는 링크
 * - 본인: 표시하지 않음 (호출하는 쪽에서 처리)
 */
export function FollowButton({
  hostId,
  path,
  following,
  count,
  loggedIn,
}: {
  hostId: string;
  path: string;
  following: boolean;
  count: number;
  loggedIn: boolean;
}) {
  const [state, action, pending] = useActionState(toggleFollowAction, initialFormState);
  const base = "inline-flex h-11 items-center justify-center px-6 text-sm font-medium transition-colors disabled:opacity-60";
  return (
    <div className="mt-6 flex flex-wrap items-center gap-4" data-testid="follow">
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
            className={following ? `${base} border border-sand-light/40 text-sand-light hover:border-sand-light` : `${base} bg-sand-light text-espresso hover:bg-sand`}
          >
            {pending ? "처리 중…" : following ? "팔로잉 ✓" : "팔로우"}
          </button>
        </form>
      ) : (
        <Link href={`/login?next=${encodeURIComponent(path)}`} className={`${base} bg-sand-light text-espresso hover:bg-sand`} data-testid="follow-login">
          로그인하고 팔로우
        </Link>
      )}
      <span className="text-sm text-sand" data-testid="follower-count">
        팔로워 {count.toLocaleString("ko-KR")}명
      </span>
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"} className={`w-full text-sm ${state.status === "error" ? "text-[#f0a08a]" : "text-sand"}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}
