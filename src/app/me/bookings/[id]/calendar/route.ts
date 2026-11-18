import type { NextRequest } from "next/server";

import { brand } from "@/config/brand";
import { getCurrentMember } from "@/lib/auth/session";
import { listMyBookings } from "@/lib/bookings/queries";

const UUID = /^[0-9a-f-]{36}$/;
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/**
 * 내 확정 신청을 캘린더에 추가(.ics) — 본인 신청만, 상세 주소 포함(확정자에게만 공개되는 정보).
 * 다른 사람의 신청 번호로는 열리지 않음(my_bookings 가 본인 것만 돌려줌).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/me/bookings/[id]/calendar">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("잘못된 요청입니다.", { status: 400 });
  const member = await getCurrentMember();
  if (!member) return new Response("로그인이 필요합니다.", { status: 401 });
  const b = (await listMyBookings()).find((x) => x.booking_id === id && x.status === "confirmed");
  if (!b) return new Response("신청을 찾을 수 없습니다.", { status: 404 });

  const origin = request.nextUrl.origin;
  const where = [b.area, b.venue_name, b.address_detail].filter(Boolean).join(" · ");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${brand.name}//booking//KO`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${b.booking_id}@${brand.name.toLowerCase()}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(b.starts_at)}`,
    `DTEND:${stamp(b.ends_at)}`,
    `SUMMARY:${esc(b.title)}`,
    `LOCATION:${esc(where)}`,
    `DESCRIPTION:${esc(`${b.host_name} · ${b.quantity}명\n${origin}/me/bookings`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(b.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking-${b.booking_id.slice(0, 8)}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
