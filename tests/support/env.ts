/**
 * 통합·화면 테스트 대상 설정.
 * - 로컬/CI: `supabase status -o env` 값 (일회용 로컬 DB)
 * - 비밀키(SUPABASE_SECRET_KEY)와 DB 주소는 테스트 계정 준비용으로만 사용하며, 로컬/CI 전용입니다.
 */
export const testEnv = {
  supabaseUrl: process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:54321",
  publishableKey: process.env.TEST_SUPABASE_PUBLISHABLE_KEY ?? "",
  secretKey: process.env.TEST_SUPABASE_SECRET_KEY ?? "",
  dbUrl: process.env.TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  mailpitUrl: process.env.TEST_MAILPIT_URL ?? "http://127.0.0.1:54324",
  appUrl: process.env.TEST_APP_URL ?? "http://localhost:3000",
};

export function requireTestEnv() {
  if (!testEnv.publishableKey || !testEnv.secretKey) {
    throw new Error(
      "TEST_SUPABASE_PUBLISHABLE_KEY / TEST_SUPABASE_SECRET_KEY 가 없습니다. `npm run test:env` 로 로컬 Supabase 값을 내보낸 뒤 실행하세요.",
    );
  }
  const host = new URL(testEnv.supabaseUrl).hostname;
  if (!["127.0.0.1", "localhost"].includes(host)) {
    throw new Error("통합 테스트는 로컬/CI의 일회용 Supabase에서만 실행합니다 (스테이징·운영 대상 금지).");
  }
}
