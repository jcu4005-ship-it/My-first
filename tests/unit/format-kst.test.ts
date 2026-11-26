import { describe, expect, it } from "vitest";

import { formatDateTime, formatYmd } from "@/lib/format";

describe("시각 표시는 서버 시간대와 상관없이 한국 시간", () => {
  it("UTC 15:30 은 한국 시간으로 다음 날 오전 12:30", () => {
    // 운영 서버(Vercel)는 UTC로 돌아가지만 관리자 화면에도 한국 시간이 보여야 한다
    const s = formatDateTime("2026-11-26T15:30:00Z");
    expect(s).toContain("2026. 11. 27.");
    expect(s).toContain("오전 12:30");
  });

  it("날짜만 보이는 곳도 한국 날짜 기준 (UTC 23:00 → 한국은 다음 날)", () => {
    expect(formatYmd("2026-11-26T23:00:00Z")).toBe("2026. 11. 27.");
  });
});
