import { describe, expect, it } from "vitest";

import { formValue } from "@/lib/forms";

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("formValue: 눈에 안 보이는 제어문자 제거", () => {
  it("널 문자·방향 뒤집기 문자를 지운다", () => {
    expect(formValue(fd({ a: "안\u0000녕‮하세요" }), "a")).toBe("안녕하세요");
  });
  it("줄바꿈·탭은 유지한다", () => {
    expect(formValue(fd({ a: "한 줄\n두 줄\t끝" }), "a")).toBe("한 줄\n두 줄\t끝");
  });
  it("비밀번호는 건드리지 않는다", () => {
    expect(formValue(fd({ password: "pa\u0001ss" }), "password")).toBe("pa\u0001ss");
  });
  it("없는 값은 빈 문자열", () => {
    expect(formValue(fd({}), "x")).toBe("");
  });
});
