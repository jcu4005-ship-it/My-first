import { describe, expect, it } from "vitest";
import { z } from "zod";

// admin 액션 파일은 서버 전용이라 같은 규칙을 그대로 복제해 검증 (빈 칸이 0으로 바뀌지 않아야 함)
const filledNumber = (message: string) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.coerce.number(message));

describe("수수료 입력: 빈 칸은 0이 아니라 오류", () => {
  const rate = filledNumber("숫자로 입력해 주세요.").pipe(z.number().min(0).max(50));
  it.each(["", "   "])("빈 값(%j)은 거부", (v) => expect(rate.safeParse(v).success).toBe(false));
  it("0은 정상 값으로 허용", () => expect(rate.parse("0")).toBe(0));
  it("일반 값 통과", () => expect(rate.parse("20")).toBe(20));
});
