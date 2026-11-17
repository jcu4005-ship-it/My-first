import type { NextRequest } from "next/server";

import { brand } from "@/config/brand";
import { getMeetup } from "@/lib/meetups/queries";

const UUID = /^[0-9a-f-]{36}$/;

/** iCalendar 글자 규칙: 쉼표·세미콜론·역슬래시·줄바꿈 이스케이프 */
function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
}

function stamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * 캘린더에 추가(.ics) — 공개 중인 프로그램의 다가오는 일정만.
 * 장소는 공개 정보(동네·장소 이름)만 넣고, 상세 주소는 넣지 않아요(참가 확정자에게만 안내).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/meetups/[id]/calendar">) {
  const { id } = await ctx.params;
  const sessionId = request.nextUrl.searchParams.get("session") ?? "";
  if (!UUID.test(id) || !UUID.test(sessionId)) return new Response("잘못된 요청입니다.", { status: 400 });
  const meetup = await getMeetup(id);
  const s = meetup?.upcomingSessions.find((x) => x.id === sessionId);
  if (!meetup || !s) return new Response("일정을 찾을 수 없습니다.", { status: 404 });

  const origin = request.nextUrl.origin;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${brand.name}//program//KO`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${s.id}@${brand.name.toLowerCase()}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(s.starts_at)}`,
    `DTEND:${stamp(s.ends_at)}`,
    `SUMMARY:${esc(meetup.title)}`,
    `LOCATION:${esc(`${s.area} · ${s.venue_name}`)}`,
    `DESCRIPTION:${esc(`${meetup.host?.display_name ?? ""} · 상세 주소는 참가 확정 후 안내됩니다.\n${origin}/meetups/${meetup.id}`)}`,
    `URL:${origin}/meetups/${meetup.id}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="program-${s.id.slice(0, 8)}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
