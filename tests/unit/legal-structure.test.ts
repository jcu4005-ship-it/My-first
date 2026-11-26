import { describe, expect, it } from "vitest";

import { BUSINESS_INFO, BUSINESS_INFO_FIELDS, businessInfoRows, isBusinessInfoComplete, missingBusinessInfo, type BusinessInfoKey } from "@/config/business";
import { LEGAL_DOCUMENTS } from "@/config/legal";

const empty = Object.fromEntries(BUSINESS_INFO_FIELDS.map((f) => [f.key, null])) as Record<BusinessInfoKey, string | null>;

describe("사업자 정보 구조", () => {
  it("아직 전달받지 않은 정보는 비워 두고(임의 값 없음), 화면에는 입력 필요로 나온다", () => {
    // 대표가 전달한 값만 채워져 있고, 통신판매업 신고번호·통신판매 고지 문구는 확정 전까지 비어 있어야 한다
    for (const key of ["mailOrderNumber", "intermediaryNotice"] as const) {
      expect(BUSINESS_INFO[key], key).toBeNull();
    }
    const rows = businessInfoRows(BUSINESS_INFO);
    expect(rows.find((r) => r.key === "mailOrderNumber")?.placeholder).toContain("입력 필요");
    expect(missingBusinessInfo(BUSINESS_INFO)).toContain("통신판매업 신고번호");
    expect(businessInfoRows(BUSINESS_INFO).find((r) => r.key === "businessNumber")?.value).toMatch(/^\d{3}-\d{2}-\d{5}$/);
    expect(isBusinessInfoComplete(BUSINESS_INFO)).toBe(false);
  });

  it("모두 채우면 완료로 본다 (공백만 있는 값은 비어 있는 것으로)", () => {
    const filled = Object.fromEntries(BUSINESS_INFO_FIELDS.map((f) => [f.key, "값"])) as Record<BusinessInfoKey, string | null>;
    expect(isBusinessInfoComplete(filled)).toBe(true);
    expect(missingBusinessInfo({ ...filled, address: "   " })).toEqual(["사업장 주소"]);
    expect(missingBusinessInfo(empty)).toHaveLength(BUSINESS_INFO_FIELDS.length);
  });

  it("전자상거래 표시에 필요한 항목이 모두 있다", () => {
    const labels = BUSINESS_INFO_FIELDS.map((f) => f.label);
    for (const need of ["상호", "대표자", "사업자등록번호", "통신판매업 신고번호", "사업장 주소", "고객센터 전화", "고객센터 이메일", "호스팅 서비스 제공", "개인정보 보호책임자"]) {
      expect(labels).toContain(need);
    }
  });
});

describe("약관·정책 문서 개정 구조", () => {
  it("문서마다 버전·개정일·시행일·이력을 갖고, 확정 전에는 날짜를 지어내지 않는다", () => {
    for (const [key, d] of Object.entries(LEGAL_DOCUMENTS)) {
      expect(d.version, key).toMatch(/\S/);
      if (d.isDraft) {
        expect(d.revisedAt, `${key} 개정일`).toBeNull();
        expect(d.effectiveAt, `${key} 시행일`).toBeNull();
      } else {
        expect(d.revisedAt, `${key} 개정일`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(d.effectiveAt, `${key} 시행일`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      for (const h of d.history as readonly { revisedAt: string; effectiveAt: string }[]) {
        expect(h.revisedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(h.effectiveAt >= h.revisedAt).toBe(true); // 시행일은 개정일 이후
      }
    }
  });

  it("약관·개인정보·환불·마케팅 문서가 모두 등록돼 있다", () => {
    expect(Object.keys(LEGAL_DOCUMENTS).sort()).toEqual(["marketing", "privacy", "refund", "terms"]);
  });
});
