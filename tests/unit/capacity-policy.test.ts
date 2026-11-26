import { describe, expect, it } from "vitest";

import { LOCKED } from "@/config/platform-policy";
import { sessionFormSchema } from "@/lib/validation/meetup";

const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
const base = { date: future, startTime: "14:00", endTime: "16:00", area: "성수동", venueName: "시험 장소", addressDetail: "", repeat: "none", opensDate: "", opensTime: "" };

describe("정원은 사이트가 약속한 '4~10명의 작은 자리'를 지킨다", () => {
  it("범위는 4~10명", () => {
    expect(LOCKED.sessionCapacity).toEqual({ min: 4, max: 10 });
  });

  it("4명·10명은 통과, 3명·11명·200명은 안내와 함께 거부", () => {
    for (const ok of [4, 8, 10]) expect(sessionFormSchema.safeParse({ ...base, capacity: String(ok) }).success, String(ok)).toBe(true);
    for (const bad of [1, 3, 11, 50, 200]) {
      const r = sessionFormSchema.safeParse({ ...base, capacity: String(bad) });
      expect(r.success, String(bad)).toBe(false);
      if (!r.success) expect(r.error.issues.map((i) => i.message).join()).toContain("작은 자리");
    }
  });
});
