import { describe, expect, it } from "vitest";

import { applicationDraftSchema, applicationSubmitSchema } from "@/lib/validation/host-application";

const base = {
  displayName: "테스트 호스트", contactPhone: "010-1234-5678", pillar: "creators", fields: "사진", headline: "", bio: "", career: "",
  credentials: "", portfolioUrl: "", teachingExperience: "", instagram: "", valueToParticipants: "", preferredFormat: "",
  passion: "시간 가는 줄 모르고 하는 일을 적습니다", oftenAsked: "주변에서 자주 묻는 것을 적습니다",
  programProposal: "골목을 걸으며 사진을 찍고 이야기를 나누는 모임입니다", consent: "on", age19: "on",
};

describe("호스트 지원: 만 19세 이상 확인", () => {
  it("확인 칸을 체크하면 제출할 수 있다", () => {
    expect(applicationSubmitSchema.safeParse(base).success).toBe(true);
  });
  it("확인 칸이 비어 있으면 제출할 수 없다", () => {
    const r = applicationSubmitSchema.safeParse({ ...base, age19: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === "age19")).toBe(true);
  });
  it("임시 저장은 확인 칸 없이도 된다", () => {
    expect(applicationDraftSchema.safeParse({ ...base, age19: "" }).success).toBe(true);
  });
});
