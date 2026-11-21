import Link from "next/link";
import { BadgeCheck, Check } from "lucide-react";

import { refundSchedule } from "@/lib/payments/refund-policy";
import { cn } from "@/lib/utils";

/*
 * "약속 옆에 증거" (대표 승인 2026-11-21): 믿어 달라고 말하지 않고, 약속 바로 옆에 눈으로 확인할 증거를 붙인다.
 * 모든 문장은 지금 사이트에 이미 있는 규칙·실제 숫자만 쓴다. 없는 것(후기·소개 글)은 없다고 말한다.
 */

/** 운영팀 확인 표시 (심사를 마치고 소개까지 채운 크리에이터에게만) */
export function VerifiedChip({ className, tone = "deep" }: { className?: string; tone?: "deep" | "light" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-bold",
        tone === "deep" ? "border-white/70 bg-black/50 text-white" : "border-navy/30 bg-card text-forest",
        className,
      )}
      data-testid="verified-chip"
    >
      <BadgeCheck aria-hidden className="size-4" strokeWidth={2} />
      운영팀 확인
    </span>
  );
}

/** 환불 3단계를 실제 날짜로 보여 주는 띠 */
export function RefundLadder({ startsAt, className }: { startsAt: string; className?: string }) {
  const r = refundSchedule(startsAt);
  return (
    <div className={cn("grid grid-cols-[1.3fr_1fr_1fr] gap-1.5 text-center text-[13px] leading-snug", className)} data-testid="refund-ladder">
      <div className="rounded-lg bg-navy px-1 py-2 text-white">
        <b className="block text-[15px]">100%</b>
        {r.fullShort}
      </div>
      <div className="rounded-lg bg-border px-1 py-2 text-foreground">
        <b className="block text-[15px]">50%</b>
        {r.halfShort}
      </div>
      <div className="rounded-lg bg-muted px-1 py-2 text-muted-foreground">
        <b className="block text-[15px]">0%</b>
        {r.dayShort}
      </div>
    </div>
  );
}

/** 체크 한 줄 */
export function CheckLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 text-[15px] leading-snug", className)}>
      <Check aria-hidden className="mt-0.5 size-4.5 shrink-0 text-forest" strokeWidth={2.4} />
      <span>{children}</span>
    </p>
  );
}

/** 운영팀이 확인한 것 (크리에이터 상세) */
export function VerifiedChecklist({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-[20px] border border-border bg-card p-4 sm:p-5", className)} data-testid="verified-checklist">
      <b className="block text-[16.5px]">운영팀이 확인한 것</b>
      <div className="mt-3 grid gap-2">
        <CheckLine>지원서를 읽고 확인했어요</CheckLine>
        <CheckLine>프로그램 내용을 검수한 뒤 공개했어요</CheckLine>
        <CheckLine>결제·환불은 라운디 안에서만 이뤄져요</CheckLine>
      </div>
    </div>
  );
}

function ProofRow({ no, title, children }: { no: string; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2.4rem_1fr] border-b border-border py-5">
      <span className="cap pt-1 text-brand">{no}</span>
      <div className="min-w-0">
        <b className="block text-[17.5px] leading-snug tracking-[-0.02em]">{title}</b>
        <div className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

/** 홈: 신청하기 전에, 직접 확인하세요 — 번호 + 가는 선 (상자 없이) */
export function HomeProofs({ startsAt }: { startsAt?: string | null }) {
  return (
    <ol className="border-t border-foreground md:grid md:grid-cols-2 md:gap-x-12" data-testid="home-trust">
      <ProofRow no="01" title="운영팀이 확인한 사람만 열어요">
        지원서와 프로그램 내용을 운영팀이 읽고 확인한 뒤에 공개해요.{" "}
        <Link href="/become-a-host" className="font-bold text-brand underline underline-offset-4">확인 기준 자세히</Link>
      </ProofRow>
      <ProofRow no="02" title="결제는 라운디 안에서만">개인 계좌로 보내 달라는 요청은 따르지 말고 운영팀에 알려 주세요.</ProofRow>
      <ProofRow no="03" title="취소 규칙을 날짜로 알려 드려요">
        프로그램 날짜 기준으로 환불이 달라져요. 크리에이터가 취소하면 전액 환불돼요.
        {startsAt ? <RefundLadder startsAt={startsAt} className="mt-3" /> : null}
      </ProofRow>
      <ProofRow no="04" title="후기는 참가한 분만 써요">아직 후기가 없다면 없다고 그대로 보여 드려요. 지어내지 않아요.</ProofRow>
    </ol>
  );
}
