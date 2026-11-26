import type { NextConfig } from "next";

import { assertValidEnv } from "./src/config/env";

// 빌드·개발 서버 시작 시 환경변수를 검증합니다. 잘못된 설정(실결제 모드, 운영 결제키,
// 브라우저로 노출되는 비밀키 등)이면 여기서 즉시 중단됩니다.
assertValidEnv(process.env);

/** 기본 보안 헤더 — 콘텐츠 보안 정책(CSP)은 결제 위젯 연동 단계에서 함께 정합니다. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    // forbidden() — 권한 없는 화면 접근 시 403 응답
    authInterrupts: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
