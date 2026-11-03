import "server-only";

import { randomUUID } from "node:crypto";

import { assertValidEnv } from "@/config/env";
import { LOCKED } from "@/config/platform-policy";

/**
 * 결제사 연결부. 지금은 테스트 모드만 존재합니다.
 * - mock: 실제 결제사를 호출하지 않는 모의 결제 (돈이 오가지 않음). 로컬·CI·스테이징 검증용.
 * - tosspayments: 테스트 키 발급 후 같은 인터페이스로 추가 예정.
 */
export type PaymentProvider = {
  id: "mock";
  label: string;
  /** 결제 승인. 실패 시 예외 */
  confirm(input: { orderId: string; amount: number }): Promise<{ paymentKey: string }>;
  /** 결제 취소(환불). 실패 시 예외 */
  refund(input: { paymentKey: string; amount: number; reason: string }): Promise<void>;
};

const mockProvider: PaymentProvider = {
  id: "mock",
  label: "모의 결제 (테스트 · 실제 청구 없음)",
  async confirm({ orderId, amount }) {
    if (!orderId || amount <= 0) throw new Error("잘못된 결제 요청");
    return { paymentKey: `mock_${randomUUID()}` };
  },
  async refund({ paymentKey }) {
    if (!paymentKey.startsWith("mock_")) throw new Error("모의 결제가 아닌 결제는 모의 환불할 수 없습니다");
  },
};

export function getPaymentProvider(): PaymentProvider {
  const env = assertValidEnv(process.env);
  if (LOCKED.livePaymentsEnabled || env.NEXT_PUBLIC_PAYMENT_MODE !== "test") {
    throw new Error("테스트 결제 모드에서만 결제할 수 있습니다.");
  }
  return mockProvider;
}
