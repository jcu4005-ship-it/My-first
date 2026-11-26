import { describe, expect, it } from "vitest";

import { isRealDate, sessionFormSchema } from "@/lib/validation/meetup";

const base = { area: "성수동", venueName: "카페 라운디", addressDetail: "", capacity: 5, startTime: "10:00", endTime: "12:00" };

describe("일정 날짜·시간 검증", () => {
  it("존재하지 않는 날짜(2월 31일)는 거부한다 — 3월 3일로 바뀌어 저장되면 안 됨", () => {
    expect(isRealDate("2099-02-31")).toBe(false);
    expect(isRealDate("2099-02-28")).toBe(true);
    expect(isRealDate("2096-02-29")).toBe(true); // 윤년
    expect(sessionFormSchema.safeParse({ ...base, date: "2099-02-31" }).success).toBe(false);
  });
  it("25:61 같은 시간은 서버 오류(예외)가 아니라 검증 실패로 돌려준다", () => {
    const r = sessionFormSchema.safeParse({ ...base, date: "2099-03-10", startTime: "25:61", endTime: "26:00" });
    expect(r.success).toBe(false);
  });
  it("정상 값은 통과한다", () => {
    expect(sessionFormSchema.safeParse({ ...base, date: "2099-03-10" }).success).toBe(true);
  });
  it("열림 시각의 잘못된 값도 예외 없이 거부한다", () => {
    expect(sessionFormSchema.safeParse({ ...base, date: "2099-03-10", opensDate: "2099-02-31", opensTime: "10:00" }).success).toBe(false);
    expect(sessionFormSchema.safeParse({ ...base, date: "2099-03-10", opensDate: "2099-03-01", opensTime: "99:99" }).success).toBe(false);
  });
});
