# 1단계 보고서 — 회원·권한

- 기간: 2026-11-03 · 기준: [1단계 계획](STAGE-1-PLAN.md) + 창업자 확정 결정 7개·추가 조건 8개
- 결제 기능: **변경 없음**. 테스트 결제 모드·실결제 차단 유지 (CI에서 매번 확인)

## 1. 확정 결정 반영 현황

| # | 결정 | 구현 | 검증 |
|---|---|---|---|
| 1 | 이메일 인증 로그인 우선, 카카오는 앱 등록 후 | 이메일 가입·인증·로그인·재설정 완료. 카카오 미구현 | E2E |
| 2 | 닉네임 중복 불허 (대소문자·공백 등 정규화) | 유니코드 NFKC + 앞뒤/연속 공백 정리 + 소문자·공백 제거 키로 고유 제약, 예약어 차단 | pgTAP(전각·대소문자·공백 변형 3종), 단위, E2E |
| 3 | 만 14세 이상 확인, 약관 문구 임시 | 가입 필수 체크(화면·서버·DB 3중). 문서 버전 `draft-2026-11-03`으로 동의 이력 저장 | pgTAP, 통합, E2E |
| 4 | 관리자 2단계 인증 필수 | admin 역할 + 토큰 aal2일 때만 관리자 기능 (서버·DB 양쪽) | pgTAP N13, 통합, E2E |
| 5 | 스테이징 DB 변경은 승인 후 | 수동 실행 + "staging" 입력 + GitHub Environment 승인자 승인 후에만 반영 | 워크플로 작성. **실행은 스테이징 준비 후** |
| 6 | 탈퇴 1단계 제외, 출시 전 필수 | `docs/LAUNCH_BLOCKERS.md` L1·L2로 추적 | — |
| 7 | 비밀번호 10자+영문·숫자, 실제 인증 설정에도 | Supabase Auth 설정(로컬 config) + 서버 검증 | **실제 Auth 서버가 약한 비밀번호를 거부하는지 통합 테스트** / 스테이징은 설정 확인 스크립트 |

## 2. 추가 개발 조건 반영 현황

| # | 조건 | 구현 |
|---|---|---|
| 1 | 내부 식별자 = 변경되지 않는 UUID | 모든 관계·권한은 `auth.users.id`(UUID) 기준. 닉네임·이메일은 식별자로 사용하지 않음 |
| 2 | 최초 관리자 분리 절차 | `private.bootstrap_first_admin` — 외부 API 비노출, 회원·서비스 키 실행 불가, 관리자 존재 시 거부, 인증 완료 회원만, 감사 기록 ([절차](../ADMIN_BOOTSTRAP.md)) |
| 3 | 감사 기록, 일반 사용자 수정·삭제 불가 | 역할 부여·회수, 회원 상태 변경, 회원 목록(이메일) 열람 기록. 수정·삭제는 관리자·DB 소유자도 트리거로 차단 |
| 4 | DB 테스트를 실제 실행 로그로 검증 | CI `db-tests` 잡 추가 — 아래 4장에 실행 번호·로그 근거 |
| 5 | 스테이징·운영 자격증명·DB 분리, 승인 없이 반영 불가 | 별도 Supabase 프로젝트 전제, 반영 워크플로에 운영 ID 일치 시 중단 장치 |
| 6 | 탈퇴·보유·파기 추적 | LAUNCH_BLOCKERS L1·L2 |
| 7 | 결과 보고 | 이 문서 |
| 8 | 결제 변경 없음, 실결제 차단 | 결제 관련 파일 변경 없음, CI N20 단계 |

## 3. 구현 내용

### DB (`supabase/migrations/20261103000100_members_and_roles.sql`)
| 테이블 | 핵심 |
|---|---|
| profiles | 공개 정보만. 본인은 닉네임·사진·소개 **열만** 수정. 상태(status)는 관리자 함수로만 |
| profile_private | 연락처·출생연도·관심사. **본인만** 조회 (호스트·관리자도 직접 조회 불가) |
| user_roles | 본인/관리자만 조회. **추가·수정·삭제 권한 없음** — 관리자 함수로만 변경 |
| legal_consents | 가입 시 트리거가 기록. 추가만 가능 |
| audit_logs | 관리자(aal2)만 조회. 추가는 함수 내부만, 수정·삭제 불가 |

- 가입 트리거는 가입 정보의 `role`·`roles` 등을 **무시하고 participant만** 부여
- 관리자 함수: `admin_set_user_role`, `admin_set_member_status`, `admin_list_members` — 사유 5자 이상 필수, 자기 관리자 회수·마지막 관리자 회수·자기 정지 거부
- 정지 회원은 프로필 수정 불가, 역할이 있어도 권한 무효

### 서버·화면
| 위치 | 내용 |
|---|---|
| `src/proxy.ts` | 세션 갱신, 보호 경로 비로그인 → 로그인 화면 |
| `src/lib/auth/session.ts`, `guards.ts` | 검증된 토큰(getClaims) + **DB에서 역할 조회**, 관리자 aal2 확인 |
| 보호 화면 | 권한 확인 후에만 응답 시작 → 권한 없으면 **HTTP 403** |
| `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/check-email`, `/auth/confirm` | 이메일 가입·인증·로그인·재설정 (다른 브라우저에서 메일을 열어도 동작하는 token_hash 방식) |
| `/me` | 프로필·비공개 정보 수정, 탈퇴 안내(준비 중) |
| `/host` | 호스트 역할 확인용 자리 (2단계에서 기능) |
| `/admin/mfa` | 관리자 인증 앱(QR) 등록·확인 |
| `/admin`, `/admin/members`, `/admin/audit` | 관리자 대시보드, 회원 검색·역할·정지, 감사 기록 |
| 로그인 후 이동 | 외부 주소로 보내는 공격(열린 리디렉트) 차단 |

## 4. 테스트 결과

### 4-1. 로컬 실행 (이 개발 환경, Docker로 로컬 Supabase 실행)
| 검사 | 결과 |
|---|---|
| DB 스키마 검사 (`supabase db lint`) | 오류·경고 0 |
| pgTAP (`npm run test:db`) | **79/79 통과** (5개 파일) |
| RLS 커버리지 (`npm run check:rls-coverage`) | 테이블 5개 모두 RLS 켜짐 + 테스트 있음 |
| API 통합 (`npm run test:integration`) | **22/22 통과** |
| 단위 (`npm run test`) | **38/38 통과** |
| 코드 검사·타입 검사 | 통과 |
| 빌드 + 번들 비밀키 검사 (`npm run scan:bundle`) | 통과 (실제 로컬 비밀키 값 대조 포함) |
| E2E (`npm run test:e2e`) | **9/9 통과**, 연속 3회 재실행 모두 통과 |

**테스트가 실제로 문제를 잡는지 확인(의도적 결함 주입)**
- user_roles에 추가 권한·정책, profile_private 전체 조회 정책을 일부러 넣음 → pgTAP **9건 실패로 탐지** → 원복
- 빌드 결과물에 가짜 비밀키 파일 삽입 → 번들 검사 **실패로 탐지**
- 테스트 없는 테이블 추가 → RLS 커버리지 검사 **실패로 탐지**

### 4-2. 권한별 결과 (부정 테스트 N1~N20)
| # | 시나리오 | 결과 | 근거 |
|---|---|---|---|
| N1 | 참가자가 자기 admin/host 역할 추가 | 거부 ✅ | pgTAP, 통합 |
| N2 | 자기 역할 수정, 남의 역할 삭제 | 거부 ✅ | pgTAP, 통합 |
| N3 | 관리자 함수·최초 관리자 함수 직접 호출 | 거부 ✅ | pgTAP, 통합 |
| N4 | 가입 정보·토큰 메타데이터에 role: admin | 무시됨 ✅ | pgTAP, 통합 |
| N5 | 자기 회원 상태 변경 | 거부 ✅ | pgTAP, 통합 |
| N6 | 자기 성인 확인 시각 변경 | 거부 ✅ | pgTAP, 통합 |
| N7 | 남의 비공개 정보 조회 | 0건 ✅ | pgTAP, 통합 |
| N8 | 남의 비공개 정보 수정 | 0건, 원본 유지 ✅ | pgTAP, 통합 |
| N9 | 호스트가 참가자 연락처 조회 | 0건 ✅ | pgTAP, 통합 |
| N10 | 비로그인이 비공개·역할·동의·감사 표 접근 | 거부 ✅ | pgTAP, 통합 |
| N11 | 남의 동의 이력 조회·추가 | 거부 ✅ | pgTAP, 통합 |
| N12 | 감사 기록 조회·추가 | 거부 ✅ | pgTAP, 통합 |
| N13 | 2단계 인증 전 관리자 | 관리자 기능 거부, `/admin/mfa`로 이동 ✅ | pgTAP, 통합, E2E |
| N14 | 자기 관리자 회수 / 마지막 관리자 회수 | 거부 ✅ | pgTAP |
| N15 | 관리자·DB 소유자의 감사·동의 기록 수정·삭제 | 거부 ✅ | pgTAP, 통합 |
| N16 | 공개 프로필로 이메일·연락처 획득 | 응답에 해당 필드 없음, 전체 열 요청 거부 ✅ | 통합 |
| N17 | 정지 회원의 수정 | 반영 안 됨 ✅ | pgTAP, 통합 |
| N18 | RLS 꺼진 테이블 | 0개 ✅ | pgTAP, 커버리지 스크립트 |
| N19 | 브라우저 JS·빌드 결과물의 비밀키 | 0건 ✅ | 번들 검사, E2E |
| N20 | live 결제 모드 빌드 | 실패(의도대로) | CI (4-3) |

권한별 화면 접근 (E2E): 비로그인 → 보호 화면 5곳 모두 로그인으로 이동 / 참가자 → `/host`·`/admin` 5곳 **HTTP 403** / 호스트 → `/host` 허용, `/admin` 403 / 관리자 → OTP 등록 후 회원 역할 부여 → 감사 기록 확인

### 4-3. GitHub Actions (실제 실행 기록)
⏳ 실행 #3 (커밋 4f1760c) 진행 중 — 결과 확인 후 이 절을 갱신합니다. 갱신 전까지 CI 결과는 "미확인"입니다.

### 4-4. 실패한 테스트와 처리
| 시점 | 실패 | 원인 | 조치 |
|---|---|---|---|
| pgTAP 1차 | 2개 파일 오류 | 테스트 코드의 문자열 비교 방식·정렬 순서 오류 | 테스트 수정 (보안 규칙 변경 없음) |
| 통합 1차 | 2건 | 테스트가 `select *` 요청 → 내부 열 때문에 DB가 거부(의도된 보호) | 공개 열만 요청하도록 수정, "전체 열 요청은 거부" 검사 추가 |
| E2E 1차 | 3건 | 로그인·로그아웃 완료 전에 다음 화면 이동(테스트 타이밍) | 완료 대기 추가 |
| 응답 코드 점검 | 403 화면이 HTTP 200으로 전송 | 화면을 나눠 보내는 구조 | 보호 화면은 권한 확인 후 응답 시작 → **403 확인**, E2E에 상태 코드 검사 추가 |
| 서버 로그 | 로그인 상태에서 "사전 생성 중 현재 시각 사용" 오류 | 토큰 만료 확인이 사전 생성 단계와 겹침 | Supabase 연결 전에 요청 시점 실행 명시 |
| E2E | 2단계 인증 직후 다시 인증 화면 | 브라우저 내부 이동이 인증 전 결과 재사용 | 인증 후 페이지 새로 불러오기 |

## 5. 미검증 항목 (외부 계정 필요 또는 미실행)
| 항목 | 상태 | 필요한 것 |
|---|---|---|
| Supabase 스테이징 DB 반영 | ⏳ 미실행 | 스테이징 프로젝트 + GitHub `staging` Environment·비밀값 3개 ([STAGING_SETUP](../STAGING_SETUP.md) A·B) |
| 스테이징 Auth 설정 일치 확인 | ⏳ 미실행 | 위 반영 워크플로 마지막 단계에서 자동 확인 |
| `deploy-db-staging` 워크플로 자체 | ⏳ 한 번도 실행 안 됨 | 위와 동일. 첫 실행 시 로그 확인 필요 |
| Vercel 스테이징 배포, V2·V3 수동 확인 | ⏳ | STAGING_SETUP C·D |
| 실제 메일 수신 (스테이징) | ⏳ | 로컬은 테스트 메일함(Mailpit)으로만 확인 |
| 카카오 로그인 | ⏳ 미구현 | 카카오 개발자 앱 등록 |
| gitleaks를 이 개발 환경에서 실행 | 실행 안 함 (외부 실행 파일 허용 안 됨) | CI에서 실행 (4-3) |

## 6. 실행 방법
```bash
npm install
npm run db:start                 # 로컬 Supabase (Docker 필요)
eval "$(npm run -s test:env)"    # 로컬 테스트용 값 불러오기
npm run test:db                  # pgTAP
npm run check:rls-coverage
npm run test:integration
npm run build && npm run scan:bundle
npm run test:e2e                 # 앱을 자동 실행해 브라우저 테스트
npm run dev                      # http://localhost:3000 (메일: http://127.0.0.1:54324)
```
로컬 첫 관리자: 가입 후 `psql`로 `select private.bootstrap_first_admin('이메일');`

## 7. 변경 파일
- DB: `supabase/migrations/20261103000100_members_and_roles.sql`, `supabase/config.toml`(Auth 규칙·MFA·메일 템플릿), `supabase/templates/*`, `supabase/tests/database/*`
- 서버·화면: `src/proxy.ts`, `src/lib/auth/*`, `src/lib/validation/*`, `src/lib/safe-redirect.ts`, `src/lib/forms.ts`, `src/lib/supabase/server.ts`, `src/app/(auth)/*`, `src/app/auth/confirm/route.ts`, `src/app/me/*`, `src/app/host/page.tsx`, `src/app/admin/*`, `src/app/forbidden.tsx`, `src/app/page.tsx`, `src/components/*`, `src/config/legal.ts`, `next.config.ts`
- 테스트: `tests/unit/validation.test.ts`, `tests/unit/env.test.ts`(V3 추가), `tests/integration/*`, `tests/e2e/*`, `tests/support/*`, `playwright.config.ts`, `vitest.integration.config.mts`
- 스크립트·CI: `scripts/*`, `.github/workflows/ci.yml`, `.github/workflows/deploy-db-staging.yml`
- 문서: `docs/ADMIN_BOOTSTRAP.md`, `docs/STAGING_SETUP.md`, `docs/LAUNCH_BLOCKERS.md`, 이 문서
