import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { brand } from "@/config/brand";
import { requireRole } from "@/lib/auth/guards";
import { formatDate, formatTime } from "@/lib/format";
import { getHostSessionsAndParticipants, getMyMeetup } from "@/lib/hosting/queries";

import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "출석부" };
export const instant = false;

/**
 * 출석부 (인쇄용) — 확정 참가자의 닉네임·인원만. 연락처는 보여 주지 않음(호스트도 볼 수 없음).
 * 당일 종이로 체크하고, 끝난 뒤 프로그램 관리 화면에서 출석을 기록하면 후기 요청까지 이어져요.
 */
export default async function RosterPage({ params, searchParams }: PageProps<"/host/meetups/[id]/roster">) {
  const { id } = await params;
  const sessionId = (await searchParams).session;
  const member = await requireRole("host", `/host/meetups/${id}/roster`);
  const meetup = await getMyMeetup(member.id, id);
  if (!meetup) notFound();
  const { sessions, participants } = await getHostSessionsAndParticipants(meetup.id);
  const s = sessions.find((x) => x.id === sessionId) ?? null;
  if (!s) notFound();
  const people = participants.filter((p) => p.session_id === s.id && p.status === "confirmed");
  const total = people.reduce((n, p) => n + p.quantity, 0);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-8 print:max-w-none print:p-0" data-testid="roster">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/host/meetups/${meetup.id}`} className="text-sm text-muted-foreground">← 프로그램 관리</Link>
        <PrintButton />
      </div>
      <p className="mt-6 text-[11px] font-extrabold tracking-[0.26em] text-ember">{brand.name} · 출석부</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.03em]">{meetup.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatDate(s.starts_at)} {formatTime(s.starts_at)} · {s.area} {s.venue_name} · 확정 {total}명 / 정원 {s.capacity}명
      </p>
      <table className="mt-6 w-full border-collapse text-[15px]">
        <thead>
          <tr className="border-y-2 border-foreground text-left text-[12px] text-muted-foreground">
            <th className="w-12 py-2">번호</th>
            <th className="py-2">닉네임</th>
            <th className="w-16 py-2 text-center">인원</th>
            <th className="w-20 py-2 text-center">참석</th>
            <th className="w-40 py-2">메모</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p, i) => (
            <tr key={p.booking_id} className="border-b border-border" data-testid="roster-row">
              <td className="py-3 tabular-nums">{i + 1}</td>
              <td className="py-3 font-semibold">{p.nickname}</td>
              <td className="py-3 text-center tabular-nums">{p.quantity}</td>
              <td className="py-3 text-center"><span className="inline-block size-5 border-2 border-foreground align-middle" aria-label="체크칸" /></td>
              <td className="py-3" />
            </tr>
          ))}
          {people.length === 0 && (
            <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">아직 확정된 참가자가 없어요.</td></tr>
          )}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-muted-foreground">참가자의 연락처는 개인정보 보호를 위해 표시하지 않아요. 프로그램이 끝나면 관리 화면에서 출석을 기록해 주세요.</p>
    </main>
  );
}
