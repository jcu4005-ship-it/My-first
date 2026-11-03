# 0단계 보고서 — 기반 준비

- 기간: 2026-11-03
- 설계 기준: [설계안 v1.0](../PLATFORM_DESIGN.md)

## 1. 실행 계획과 완료 조건

| # | 작업 | 완료 조건 | 결과 |
|---|---|---|---|
| 1 | 설계안 v1.0 확정 반영 | 최종 결정 7개 반영 | ✅ |
| 2 | Next.js + TypeScript + Tailwind 프로젝트 생성 | 빌드 성공 | ✅ |
| 3 | shadcn/ui 구조 | `components.json`, `cn()`, Button 동작 | ✅ (아래 주의 1) |
| 4 | 브랜드 설정 구조 | 서비스명이 설정 파일 1곳에만 존재 (자동 테스트) | ✅ |
| 5 | 디자인 토큰·글꼴 | 색·글꼴이 CSS 변수 1곳에서 관리, 모바일 가로 스크롤 없음 | ✅ |
| 6 | 환경변수 검증 | 실결제 모드·운영 키·노출 비밀키 차단 (자동 테스트) | ✅ |
| 7 | 테스트/운영 환경 분리 | 환경 표시 띠, 운영 필수값 검증, `.env.example` | ✅ |
| 8 | Supabase 연결 코드 | 브라우저·서버 연결 모듈, 로컬 설정 파일 | ✅ 코드 / ⏳ 실제 연결 |
| 9 | Vercel 배포 설정 | 서울 리전 설정, 상태 확인 주소 | ✅ 설정 / ⏳ 실제 배포 |
| 10 | 자동 검사(CI) | 코드검사·타입·테스트·빌드·비밀키 검사 워크플로 | ✅ 작성 / ⏳ GitHub 실행 확인 |

## 2. 변경 파일

| 파일 | 내용 |
|---|---|
| `docs/PLATFORM_DESIGN.md` | v1.0 확정 (최종 결정 반영) |
| `package.json`, `package-lock.json` | 프로젝트·의존성·실행 명령 |
| `next.config.ts` | 빌드 시 환경변수 검증, 보안 헤더 |
| `src/config/brand.ts` | 브랜드 정보 (가칭) |
| `src/config/env.ts` | 환경변수 검증 규칙 |
| `src/config/platform-policy.ts` | 잠금 규칙(수동 정산, 실결제 비활성, 인원 1~4, 부분 취소 제외, 주류 잠금)과 정산 초기값 |
| `src/app/layout.tsx`, `page.tsx`, `globals.css`, `icon.svg`, `fonts/` | 기본 레이아웃, 임시 홈, 디자인 토큰, Pretendard 글꼴 |
| `src/components/environment-banner.tsx` | 스테이징/로컬·테스트 결제 표시 띠 |
| `src/components/ui/button.tsx`, `src/lib/utils.ts`, `components.json` | shadcn/ui 기본 |
| `src/app/api/health/route.ts` | 상태 확인 주소 |
| `src/lib/supabase/*` | Supabase 연결 모듈 |
| `supabase/config.toml` | 로컬 Supabase 설정 |
| `tests/unit/*` | 자동 테스트 3개 파일 |
| `.env.example`, `.gitignore`, `vercel.json`, `vitest.config.mts`, `.github/workflows/ci.yml` | 환경·배포·CI |
| `README.md`, `docs/SETUP.md` | 실행 방법, 외부 서비스 연결 가이드 |

## 3. 실행 방법

```bash
npm install
npm run dev        # http://localhost:3000
npm run check      # 검사 + 테스트
npm run build
```

## 4. 테스트 결과 (실제 실행)

| 검사 | 결과 |
|---|---|
| `npm run lint` | 통과 (경고·오류 0) |
| `npm run typecheck` | 통과 |
| `npm run test` (vitest 5.1) | **19개 중 19개 통과** (환경변수 12, 정책 잠금·브랜드 6, 브랜드 하드코딩 1) |
| `npm run build` | 성공 |
| `NEXT_PUBLIC_PAYMENT_MODE=live` 로 빌드 | **의도대로 실패** ("실결제(live) 모드는 아직 허용되지 않습니다") |
| `/api/health` | `paymentMode: test`, `livePaymentsEnabled: false`, `settlementMode: manual`, 비밀값 미포함 |
| 보안 헤더 | nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS 응답 확인 |
| 브라우저 확인 (390px 모바일·1280px 데스크톱) | 가로 스크롤 없음, 콘솔 오류 0, 테스트 결제 표시 띠 노출 |

## 5. 미해결 문제 / 주의 사항

1. **shadcn/ui 설치 도구 사용 불가** — 이 개발 환경의 네트워크 정책이 shadcn 서버를 차단해 `shadcn init`이 실패했습니다. 같은 구조(`components.json`, `cn()`, Button)를 npm 패키지로 직접 구성했습니다. 이후 컴포넌트는 같은 방식으로 추가하거나, 차단이 없는 환경에서 `npx shadcn add`로 추가할 수 있습니다.
2. **Supabase·Vercel 실제 연결 미완료** — 창업자 계정이 필요합니다. [SETUP.md](../SETUP.md) 1~2번 진행 후 `/api/health`에서 연결을 확인합니다.
3. **로컬 Supabase(Docker) 실행 미검증** — 이 개발 환경에서 Docker를 실행할 수 없어 `npm run db:start`는 확인하지 못했습니다. 1단계의 DB 권한(RLS) 테스트는 로컬 또는 CI의 Supabase에서 실행해야 하므로, 1단계 시작 시 CI에 Supabase 테스트 환경을 추가하는 방안을 함께 진행합니다.
4. **GitHub CI 실행 미확인** — 워크플로 파일만 작성했고, GitHub에서 실제 실행 결과는 아직 확인하지 않았습니다.
5. **보안 헤더 중 콘텐츠 보안 정책(CSP)** 은 토스 결제 위젯 연동(4단계) 때 허용 도메인과 함께 설정합니다.
6. **의존성 보안 점검(`npm audit`)** — 서비스에 실제 포함되는 패키지: **취약점 0건**. 테스트 도구(vitest)의 critical 경고는 최신 버전(5.1)으로 올려 해결했습니다. 남은 moderate 16건은 모두 코드 검사 도구(ESLint) 내부의 `minimatch` 경고로 개발용이며 배포 결과물에 포함되지 않습니다. ESLint 업데이트가 나오면 반영합니다.
7. `AGENTS.md`는 Next.js가 자동 생성하는 개발 도구용 안내 파일입니다(서비스와 무관).

## 6. 다음 단계(1단계: 회원·권한) 진행 전 필요한 것

- (권장) Supabase 스테이징 프로젝트 생성 — SETUP.md 1번
- 카카오 로그인용 카카오 개발자 앱 등록 — 1단계 계획에서 절차 안내 예정
