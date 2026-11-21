import { describe, expect, it } from "vitest";

import { isDemoProfile, isVerifiedHost } from "@/lib/hosting/demo";

describe("가상(시연용) 소개", () => {
  it("'가상 소개'가 들어 있으면 가상으로 본다", () => {
    expect(isDemoProfile({ bio: "(가상 소개 · 시연용) 안녕하세요" })).toBe(true);
    expect(isDemoProfile({ headline: "스피치 강사 (가상)" })).toBe(true);
    expect(isDemoProfile({ career: "(가상 경력 · 시연용) …" })).toBe(true);
    expect(isDemoProfile({ bio: "실제로 직접 쓴 소개" })).toBe(false);
    expect(isDemoProfile(null)).toBe(false);
  });
  it("가상 소개만 있는 크리에이터에게는 '운영팀 확인' 표시를 켜지 않는다", () => {
    expect(isVerifiedHost({ bio: "(가상 소개 · 시연용) 안녕하세요", is_sample: false })).toBe(false);
    expect(isVerifiedHost({ bio: "실제로 직접 쓴 소개", is_sample: false })).toBe(true);
    expect(isVerifiedHost({ headline: "한 줄", is_sample: true })).toBe(false);
  });
});
