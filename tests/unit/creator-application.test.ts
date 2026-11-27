import { describe, expect, it } from "vitest";

import { creatorApplicationSchema } from "@/lib/validation/creator-application";

const base = {
  name: "지원자",
  field: "art_culture",
  strength: "골목 사진을 잘 찍어요",
  experience: "동네 사진 모임을 운영했어요",
  motivation: "경험을 나누고 싶어요",
  phone: "010-1234-5678",
  link: "",
  wish: "",
  age19: "on",
  consent: "on",
};

describe("크리에이터 지원 입력 검사", () => {
  it("필수 항목만 채워도 통과하고, 번호는 숫자만 남긴다", () => {
    const r = creatorApplicationSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe("01012345678");
  });

  it("필수 항목이 비면 항목별로 안내한다", () => {
    const r = creatorApplicationSchema.safeParse({ ...base, name: "", field: "", strength: "", experience: "", motivation: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0]);
      expect(paths).toEqual(expect.arrayContaining(["name", "field", "strength", "experience", "motivation"]));
    }
  });

  it("분야는 정해진 5가지만, 링크는 https만, 동의는 필수", () => {
    expect(creatorApplicationSchema.safeParse({ ...base, field: "music" }).success).toBe(false);
    expect(creatorApplicationSchema.safeParse({ ...base, link: "http://x.example" }).success).toBe(false);
    expect(creatorApplicationSchema.safeParse({ ...base, link: "https://x.example/me" }).success).toBe(true);
    expect(creatorApplicationSchema.safeParse({ ...base, consent: "" }).success).toBe(false);
    expect(creatorApplicationSchema.safeParse({ ...base, age19: "" }).success).toBe(false); // 만 19세 확인 필수
  });

  it("휴대폰 번호 형식을 검사한다", () => {
    expect(creatorApplicationSchema.safeParse({ ...base, phone: "12345" }).success).toBe(false);
    expect(creatorApplicationSchema.safeParse({ ...base, phone: "01012345678" }).success).toBe(true);
  });
});
