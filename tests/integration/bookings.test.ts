import { beforeAll, describe, expect, it } from "vitest";

import { requireTestEnv } from "../support/env";
import { createMember, dbQuery, makeApprovedHost, type TestMember } from "../support/fixtures";

/**
 * 정원·중복 방지를 실제 동시 요청으로 확인합니다.
 * (모임 준비는 DB 소유자 권한으로 직접 만들고, 신청은 실제 로그인 사용자로 호출)
 */
let host: TestMember;
let sessionId: string;
let meetupId: string;

beforeAll(async () => {
  requireTestEnv();
  host = await createMember("bh");
  await makeApprovedHost(host.id);
  const [m] = await dbQuery<{ id: string }>(
    `insert into public.meetups (host_id, category_slug, title, summary, description, price, max_quantity_per_booking, status, published_at)
     values ($1, 'reading', '동시 신청 테스트 모임', '동시 신청 테스트 모임 요약입니다', '동시 신청 테스트 모임 상세 설명입니다.', 10000, 2, 'published', now())
     returning id`,
    [host.id],
  );
  meetupId = m.id;
  const [s] = await dbQuery<{ id: string }>(
    `insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity)
     values ($1, now() + interval '7 days', now() + interval '7 days 2 hours', '성수동', '테스트 장소', '비밀 주소', 3) returning id`,
    [meetupId],
  );
  sessionId = s.id;
});

describe("참가 신청 동시성", () => {
  it("남은 자리 3개에 8명이 동시에 신청하면 정확히 3명만 확정된다", async () => {
    const users = await Promise.all(Array.from({ length: 8 }, (_, i) => createMember(`bc${i}`)));
    const results = await Promise.all(users.map((u) => u.client.rpc("book_session", { p_session_id: sessionId, p_quantity: 1 })));
    const ok = results.filter((r) => !r.error);
    const full = results.filter((r) => r.error?.hint === "full");
    expect(ok).toHaveLength(3);
    expect(full).toHaveLength(5);
    const [row] = await dbQuery<{ reserved_count: number; confirmed: string }>(
      `select s.reserved_count, (select count(*) from public.bookings b where b.session_id = s.id and b.status = 'confirmed') as confirmed
       from public.meetup_sessions s where s.id = $1`,
      [sessionId],
    );
    expect(row.reserved_count).toBe(3);
    expect(Number(row.confirmed)).toBe(3);
  });

  it("같은 사람이 동시에 5번 눌러도 신청은 1건만 생긴다", async () => {
    await dbQuery("update public.meetup_sessions set capacity = 50 where id = $1", [sessionId]);
    const u = await createMember("bdup");
    const results = await Promise.all(
      Array.from({ length: 5 }, () => u.client.rpc("book_session", { p_session_id: sessionId, p_quantity: 1 })),
    );
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    const rows = await dbQuery("select id from public.bookings where user_id = $1 and status = 'confirmed'", [u.id]);
    expect(rows).toHaveLength(1);
  });

  it("취소하면 자리가 돌아오고, 다시 신청할 수 있다", async () => {
    const u = await createMember("bcancel");
    const { data: bookingId, error } = await u.client.rpc("book_session", { p_session_id: sessionId, p_quantity: 2 });
    expect(error).toBeNull();
    const before = (await dbQuery<{ reserved_count: number }>("select reserved_count from public.meetup_sessions where id = $1", [sessionId]))[0].reserved_count;
    expect((await u.client.rpc("cancel_booking", { p_booking_id: bookingId })).error).toBeNull();
    const after = (await dbQuery<{ reserved_count: number }>("select reserved_count from public.meetup_sessions where id = $1", [sessionId]))[0].reserved_count;
    expect(after).toBe(before - 2);
    expect((await u.client.rpc("cancel_booking", { p_booking_id: bookingId })).error?.hint).toBe("already_cancelled");
    expect((await u.client.rpc("book_session", { p_session_id: sessionId, p_quantity: 1 })).error).toBeNull();
  });

  it("다른 사람의 신청은 취소할 수 없다", async () => {
    const owner = await createMember("bown");
    const other = await createMember("both");
    const { data: bookingId } = await owner.client.rpc("book_session", { p_session_id: sessionId, p_quantity: 1 });
    const r = await other.client.rpc("cancel_booking", { p_booking_id: bookingId });
    expect(r.error?.hint).toBe("not_found");
    const [b] = await dbQuery<{ status: string }>("select status from public.bookings where id = $1", [bookingId]);
    expect(b.status).toBe("confirmed");
  });

  it("호스트에게 보이는 참가자 정보에는 연락처가 없다", async () => {
    const { data, error } = await host.client.rpc("host_meetup_participants", { p_meetup_id: meetupId });
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(Object.keys(data![0]).sort()).toEqual(["booking_id", "created_at", "nickname", "quantity", "session_id", "status"]);
  });
});
