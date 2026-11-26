/**
 * 사업자 정보 (전자상거래 사업자 표시 항목)
 *
 * ⚠ 값은 사업자등록증·통신판매업 신고증에 적힌 그대로 직접 입력합니다. 임의로 만들거나 추정해 적지 않습니다.
 *   - null 이면 화면에 "입력 필요" 표시가 나옵니다 (바닥글·약관·결제 화면에 같은 값이 쓰임).
 *   - 모두 채우면 표시가 사라집니다. 정식 오픈 전 필수 항목입니다 (docs/LEGAL_POLICY_SYSTEM.md, docs/LAUNCH_BLOCKERS.md B8).
 */
export type BusinessInfoKey =
  | "companyName"
  | "representative"
  | "businessNumber"
  | "mailOrderNumber"
  | "address"
  | "csPhone"
  | "csEmail"
  | "csHours"
  | "hosting"
  | "privacyOfficer"
  | "intermediaryNotice";

export const BUSINESS_INFO: Record<BusinessInfoKey, string | null> = {
  companyName: "라운디", // 상호 (사업자등록증)
  representative: "주찬욱", // 대표자 이름
  businessNumber: "762-03-03732", // 사업자등록번호 (000-00-00000)
  mailOrderNumber: null, // 통신판매업 신고번호 (신고 후 발급)
  address: "서울특별시 마포구 임정로21길 75(신공덕동)", // 사업장 주소 (사업자등록증)
  csPhone: "010-7574-4005", // 고객센터 전화번호
  csEmail: "cksdnr5551@naver.com", // 고객센터 이메일
  csHours: "평일 10:00~18:00", // 고객센터 운영시간
  // 호스팅 제공자는 프로젝트가 실제로 쓰는 서비스를 적은 값입니다. 계약·약관상 정확한 법인명은 확인 후 확정하세요.
  hosting: "Vercel Inc. (웹 호스팅), Supabase Inc. (데이터베이스·인증)",
  privacyOfficer: "주찬욱 (대표자) · cksdnr5551@naver.com", // 개인정보 보호책임자 (이름·연락처)
  // 통신판매중개 관련 고지 문구. 플랫폼의 법적 지위·책임 범위는 법률 검토 후 확정한 문구를 그대로 입력합니다. (임의로 적지 않음)
  intermediaryNotice: null,
};

/** 화면에 보여 줄 순서와 이름 */
export const BUSINESS_INFO_FIELDS: { key: BusinessInfoKey; label: string; placeholder: string }[] = [
  { key: "companyName", label: "상호", placeholder: "상호 입력 필요" },
  { key: "representative", label: "대표자", placeholder: "대표자 입력 필요" },
  { key: "businessNumber", label: "사업자등록번호", placeholder: "사업자등록번호 입력 필요" },
  { key: "mailOrderNumber", label: "통신판매업 신고번호", placeholder: "통신판매업 신고번호 입력 필요 (신고 후 발급)" },
  { key: "address", label: "사업장 주소", placeholder: "주소 입력 필요" },
  { key: "csPhone", label: "고객센터 전화", placeholder: "전화번호 입력 필요" },
  { key: "csEmail", label: "고객센터 이메일", placeholder: "이메일 입력 필요" },
  { key: "csHours", label: "운영시간", placeholder: "운영시간 입력 필요" },
  { key: "hosting", label: "호스팅 서비스 제공", placeholder: "호스팅 제공자 입력 필요" },
  { key: "privacyOfficer", label: "개인정보 보호책임자", placeholder: "보호책임자 입력 필요" },
  { key: "intermediaryNotice", label: "통신판매 관련 고지", placeholder: "고지 문구 입력 필요 (법률 검토 후 확정)" },
];

export function businessInfoRows(info: Record<BusinessInfoKey, string | null> = BUSINESS_INFO) {
  return BUSINESS_INFO_FIELDS.map((f) => ({ ...f, value: info[f.key]?.trim() || null }));
}

/** 입력이 필요한(비어 있는) 항목 이름들 */
export function missingBusinessInfo(info: Record<BusinessInfoKey, string | null> = BUSINESS_INFO): string[] {
  return businessInfoRows(info).filter((r) => !r.value).map((r) => r.label);
}

export const isBusinessInfoComplete = (info?: Record<BusinessInfoKey, string | null>) => missingBusinessInfo(info).length === 0;
