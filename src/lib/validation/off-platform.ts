import { brand } from "@/config/brand";

/**
 * 플랫폼 밖 결제·연락 유도 막기: 참가비는 반드시 플랫폼 결제로만 받습니다.
 * 계좌번호·전화번호(숫자 10자리 이상), 송금·현장 결제 안내, 오픈채팅·송금 링크를 찾습니다.
 * 날짜(2026-11-17)·시간·가격(30,000원)은 걸리지 않게 숫자 10자리 미만은 통과시킵니다.
 */
export const OFF_PLATFORM_MESSAGE = `참가비는 ${brand.name} 결제로만 받을 수 있어요. 계좌·전화번호·외부 결제나 송금 안내는 적을 수 없어요.`;

const WORDS = /(계좌|무통장|송금|현금\s*(결제|으로\s*(내|결제|받))|현장\s*(결제|에서\s*결제|지불)|따로\s*(결제|입금|지불)|직접\s*(입금|결제\s*해)|입금\s*(계좌|해\s*주))/;
const LINKS = /(open\.kakao\.com|pf\.kakao\.com|qr\.kakaopay\.com|toss\.me|link\.kakaopay)/i;
const NUMBER_RUN = /\d[\d\s.-]{8,}\d/g;

export function hasOffPlatformPayment(text: string): boolean {
  if (!text) return false;
  if (WORDS.test(text) || LINKS.test(text)) return true;
  for (const m of text.match(NUMBER_RUN) ?? []) {
    if (m.replace(/\D/g, "").length >= 10) return true;
  }
  return false;
}
