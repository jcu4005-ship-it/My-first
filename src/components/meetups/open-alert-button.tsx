import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";

import { openAlertAction } from "@/app/meetups/[id]/actions";

/** "열리면 알림 받기" — 로그인 필요. 켜 두면 열리기 1시간 전과 열리는 순간에 사이트 안 알림 */
export function OpenAlertButton({
  meetupId,
  sessionId,
  on,
  loggedIn,
  size = "default",
  className,
}: {
  meetupId: string;
  sessionId: string;
  on: boolean;
  loggedIn: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  if (!loggedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/meetups/${meetupId}`)}`}
        className={className ?? "inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-[15px] font-bold text-primary-foreground hover:bg-primary/90"}
        data-testid="open-alert-login"
      >
        로그인하고 열리면 알림 받기
      </Link>
    );
  }
  return (
    <ActionForm
      action={openAlertAction}
      hidden={{ meetupId, sessionId, op: on ? "off" : "on" }}
      label={on ? "알림 켜짐 · 끄기" : "열리면 알림 받기"}
      variant={on ? "outline" : "default"}
      size={size}
      testId={on ? "open-alert-off" : "open-alert-on"}
      className={className}
    />
  );
}
