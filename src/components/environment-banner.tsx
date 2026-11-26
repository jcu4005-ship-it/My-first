import type { AppEnv, PaymentMode } from "@/config/env";

/**
 * 운영(production)이 아닌 환경과 테스트 결제 모드를 화면 상단에 항상 표시합니다.
 * 테스트 결제가 실제 결제로 오해되지 않게 하기 위한 장치입니다.
 */
export function EnvironmentBanner({
  appEnv,
  paymentMode,
}: {
  appEnv: AppEnv;
  paymentMode: PaymentMode;
}) {
  const labels: string[] = [];
  if (appEnv !== "production") {
    labels.push(appEnv === "staging" ? "스테이징(검수용) 환경" : "로컬 개발 환경");
  }
  if (paymentMode === "test") {
    labels.push("테스트 결제 모드 — 실제 결제·청구가 발생하지 않습니다");
  }
  if (labels.length === 0) return null;

  return (
    <div
      role="status"
      data-testid="environment-banner"
      className="bg-notice px-4 py-2 text-center text-xs text-notice-foreground"
    >
      {labels.join(" · ")}
    </div>
  );
}
