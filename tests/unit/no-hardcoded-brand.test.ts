import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { brand } from "@/config/brand";

/** 브랜드명이 설정 파일 밖에 직접 적혀 있지 않은지 검사합니다. (설계안 2-5) */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("브랜드명 하드코딩 금지", () => {
  it("src/config/brand.ts 외의 소스에 서비스명이 직접 나오지 않는다", () => {
    const offenders = walk("src")
      .filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith(join("config", "brand.ts")))
      .filter((f) => readFileSync(f, "utf8").includes(brand.name));
    expect(offenders).toEqual([]);
  });
});
