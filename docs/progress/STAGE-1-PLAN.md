# 1단계 실행 계획 — 회원·권한 (검토용, 코드 작성 전)

- 작성일: 2026-11-03 · 상태: **창업자 검토 대기 — 승인 전 1단계 코드 작성 없음**
- 기준: [설계안 v1.0](../PLATFORM_DESIGN.md) 3-3(1), 4장
- 표기: ✅ 완료 조건 / ▶ 실행·확인 방법 / ◎ 예상 결과 / ⚠ 실패 시 대응

---

## 0. 1단계 범위

### 포함
| 영역 | 내용 |
|---|---|
| 회원가입·로그인 | 이메일+비밀번호 가입(이메일 인증 필수), 로그인/로그아웃, 비밀번호 재설정, 카카오 로그인(카카오 앱 등록 완료 시 — 결정 D1) |
| 동의 | 이용약관·개인정보 수집·만 14세 이상 확인(필수), 마케팅 수신(선택) — **문구는 임시**, 출시 전 법률 검토(설계안 9-4) |
| 프로필 | 공개 프로필(닉네임·사진·소개), 비공개 정보(전화번호·출생연도·관심사) 분리 저장 |
| 권한 | 참가자/호스트/관리자 역할 표, 관리자 역할 변경 기능(감사 기록), 관리자 2단계 인증(OTP) |
| 보호 | DB RLS, 서버 권한 검사, 경로 보호(proxy), 감사 기록 |
| 검증 | DB 권한 테스트(pgTAP), API 부정 테스트, 화면 흐름 테스트, 번들 비밀키 검사, CI 확장 |
| 연결 | Supabase 스테이징·Vercel 스테이징 연결 (창업자 계정 준비 완료 시) |

### 제외 (다음 단계 이후)
| 항목 | 이유 / 시점 |
|---|---|
| 호스트 신청·승인 화면 | 2단계 (1단계는 역할 부여 기반만) |
| 회원 탈퇴 | 탈퇴 시 파기·보존 기준(설계안 9-4 D4) 검토 후 — 1단계는 "운영팀 문의" 안내만 (결정 D6) |
| 휴대폰 본인인증 | 설계안 확정대로 MVP 제외 |
| 예약·결제 데이터 | 4단계. **예약 내역 부정 테스트는 예약 테이블이 생기는 4단계에서 실행**하며, 1단계에서는 그 테스트를 쉽게 붙일 수 있는 공통 테스트 도구와 "새 테이블은 RLS 테스트 없이는 통과 불가" 규칙을 만듭니다(6-4). |
| 결제 관련 변경 | 없음. 테스트 결제 모드·실결제 차단 그대로 유지 (9장) |

---

## 1. 회원가입·로그인

### 1-1. 흐름
```
[가입] 이메일·비밀번호·닉네임 + 필수 동의 체크
   → Supabase Auth 가입 → 인증 메일 발송
   → 메일 링크 클릭 → /auth/confirm (서버가 인증 코드 검증) → 로그인 상태로 /me
[로그인] 이메일·비밀번호 또는 카카오 → /auth/callback (서버가 코드 교환) → 원래 가려던 화면
[재설정] /forgot-password → 메일 → /reset-password (새 비밀번호)
[카카오 첫 로그인] 동의 항목이 없으면 /onboarding/consents 로 보내 필수 동의 후 이용
```

### 1-2. 화면
| 주소 | 용도 | 접근 |
|---|---|---|
| `/signup`, `/login` | 가입·로그인 | 비로그인 |
| `/forgot-password`, `/reset-password` | 비밀번호 재설정 | 비로그인 / 재설정 링크 |
| `/auth/confirm`, `/auth/callback` | 인증 처리(화면 없음) | 서버 처리 |
| `/onboarding/consents` | 필수 동의 미완료자 | 로그인 |
| `/me` | 내 프로필 보기·수정 | 로그인 |
| `/host` | 호스트 영역 자리(빈 화면) | 호스트 역할 |
| `/admin`, `/admin/members` | 관리자 대시보드 자리, 회원 목록·역할 변경 | 관리자 + 2단계 인증 |
| `/admin/mfa` | 관리자 OTP 등록·인증 | 관리자 |

### 1-3. 보안 설정 (Supabase Auth)
| 항목 | 설정 |
|---|---|
| 이메일 인증 | 필수 (인증 전 로그인 불가) |
| 비밀번호 | 최소 10자, 영문+숫자 포함 (Supabase 설정 + 서버 검증 이중) |
| 로그인 시도 제한 | Supabase 기본 제한 사용, 스테이징에서 동작 확인 |
| 세션 확인 | 서버에서는 반드시 `getClaims()`/`getUser()`로 **검증된** 정보만 사용 (`getSession()` 결과 신뢰 금지) |
| 역할 정보 | 로그인 토큰의 사용자 수정 가능 영역(user_metadata)은 **권한 판단에 절대 사용 안 함** |
| 이메일 발송 | 로컬·CI는 내장 테스트 메일함(Mailpit). 스테이징은 Supabase 기본 발송(발송량·수신자 제한 있음) → 출시 전 자체 발송 서비스(SMTP) 연결 필요 |

### 1-4. 완료 조건
| | 내용 |
|---|---|
| ✅ | 이메일 가입→인증→로그인→로그아웃→재설정 전 과정이 자동 화면 테스트(E2E)로 통과. 인증 안 한 계정은 로그인 거부 |
| ▶ | CI의 E2E 잡 (`npm run test:e2e`), 스테이징에서 창업자 이메일로 수동 1회 |
| ◎ | 테스트 전부 통과, 스테이징에서 인증 메일 수신·로그인 성공 |
| ⚠ | 메일 미수신 → Supabase Auth 로그·발송 제한 확인 / 리디렉트 오류 → Supabase "Redirect URLs"에 스테이징 주소 추가 / 카카오 실패 → 카카오 앱 Redirect URI·동의 항목 점검, 해결 전까지 카카오 버튼 숨김(이메일 로그인은 영향 없음) |

---

## 2. 권한 구조

### 2-1. 역할 규칙
| 역할 | 부여 방법 | 회수 | 비고 |
|---|---|---|---|
| participant | 가입 시 DB가 자동 부여 | 불가(정지는 status로) | 모든 회원 기본 |
| host | 관리자만 (2단계부터 호스트 승인 절차와 연결) | 관리자만 | |
| admin | **최초 1명: 창업자가 Supabase 대시보드 SQL로 직접 지정**(절차 문서 제공) / 이후: 2단계 인증한 관리자만 | 관리자만. 단 **자기 자신 해제 불가, 마지막 관리자 해제 불가** | 모든 변경은 감사 기록 |

### 2-2. 3중 검사
```
① 화면:  권한 없는 메뉴 숨김 (편의용)
② 서버:  proxy(경로 1차 차단) → 각 화면 레이아웃·서버 처리에서 requireRole() 재확인
③ DB:    RLS + 열(column) 단위 권한 + 보안 함수 — 최종 방어선
```
- 서버 검사 `requireRole()`은 로그인 토큰이 아닌 **DB의 user_roles 표를 직접 조회**합니다(토큰은 바뀐 권한이 늦게 반영될 수 있음).
- 관리자 기능은 토큰의 인증 수준이 `aal2`(2단계 인증 완료)일 때만 허용 — 서버와 DB 양쪽에서 확인.

### 2-3. 완료 조건
| | 내용 |
|---|---|
| ✅ | 참가자가 어떤 경로(화면 조작, API 직접 호출, 토큰 메타데이터 수정)로도 호스트·관리자가 될 수 없음이 부정 테스트로 증명됨 (6-2의 N1~N6) |
| ▶ | `supabase test db`(DB) + `npm run test:integration`(API) — CI에서 실행 |
| ◎ | 부정 테스트 전부 "거부됨"으로 통과 |
| ⚠ | 하나라도 허용되면 **1단계 완료 보고 불가**. 원인 정책 수정 → 테스트 재실행 → 보고서에 원인·수정 내용 기록 |

---

## 3. DB 스키마 (1단계 마이그레이션)

> 마이그레이션 = DB 구조 변경을 파일(`supabase/migrations/*.sql`)로 남겨 순서대로 적용하는 방식. 한 번 적용된 파일은 고치지 않고 새 파일로만 변경합니다.

### 3-1. 테이블
**`app_role` (값 목록)**: `participant` | `host` | `admin`
**`member_status` (값 목록)**: `active` | `suspended` | `withdrawn`

**profiles** — 공개 정보만
| 컬럼 | 타입 | 규칙 |
|---|---|---|
| id | uuid PK → auth.users | 가입 시 자동 생성 |
| nickname | text | 2~20자, **대소문자 무시 중복 불가**(결정 D2) |
| avatar_url | text null | 2단계에서 업로드 연결 |
| bio | text null | 최대 300자 |
| status | member_status | 기본 active. **본인 수정 불가** |
| created_at, updated_at | timestamptz | |

**profile_private** — 비공개 정보 (호스트 접근 불가)
| 컬럼 | 타입 | 규칙 |
|---|---|---|
| user_id | uuid PK → profiles | |
| phone | text null | 형식 검사(숫자 10~11자리) |
| birth_year | smallint null | 1900~현재 |
| interests | text[] | 카테고리 코드 목록 |
| adult_verified_at | timestamptz null | **본인 수정 불가**(주류 검토 후 사용) |
| updated_at | timestamptz | |

**user_roles**
| 컬럼 | 규칙 |
|---|---|
| user_id, role | 복합 PK (같은 역할 중복 불가) |
| granted_by, granted_at | 누가 언제 |

**legal_consents** — 동의 이력 (수정·삭제 불가, 추가만)
| 컬럼 | 규칙 |
|---|---|
| id, user_id | |
| consent_type | `terms` / `privacy` / `age_14_plus` / `marketing` |
| document_version | 약관 버전 문자열 |
| agreed | true/false (마케팅 철회도 새 줄로 기록) |
| created_at | |

**audit_logs** — 관리자 행동 기록 (관리자도 수정·삭제 불가)
| 컬럼 | 규칙 |
|---|---|
| id, actor_id, action | 예: `role.grant`, `role.revoke`, `member.suspend`, `pii.view` |
| target_type, target_id | |
| before, after | jsonb (변경 전후 값) |
| reason | 필수(역할 변경 시) |
| created_at | |

### 3-2. 함수·트리거
| 이름 | 종류 | 역할 |
|---|---|---|
| `private.handle_new_user()` | 트리거(auth.users 추가 시) | profiles·profile_private 생성, participant 역할 부여. 닉네임은 가입 입력값 검증 후 사용 |
| `private.has_role(role)` | 보안 함수 | 현재 사용자의 역할 보유 여부 (RLS에서 사용) |
| `private.is_admin()` | 보안 함수 | admin 역할 **그리고** 토큰 aal = aal2 |
| `public.admin_set_user_role(user, role, grant, reason)` | 관리자 전용 함수 | 역할 부여/회수 + 감사 기록. 자기 admin 해제·마지막 admin 해제 거부 |
| `public.admin_set_member_status(user, status, reason)` | 관리자 전용 함수 | 정지/해제 + 감사 기록 |
| `public.record_consents(...)` | 본인 함수 | 본인 동의 이력 추가 |
| `private.block_mutation()` | 트리거 | audit_logs·legal_consents의 수정·삭제 차단 |

- `private` 스키마는 외부 API로 노출되지 않습니다(외부에서 직접 호출 불가).
- 모든 보안 함수는 `search_path`를 고정해 함수 바꿔치기 공격을 막습니다.
- 함수 실행 권한은 기본 회수 후 필요한 것만 부여합니다.

---

## 4. RLS 정책

> RLS = 표의 각 줄마다 "누가 읽고/쓰고/지울 수 있나"를 DB가 직접 검사하는 규칙. 기본은 **전부 차단**, 필요한 것만 허용합니다.

### 4-1. 정책표
| 테이블 | 비로그인(anon) | 본인 | 다른 회원 | 호스트 | 관리자(aal2) |
|---|---|---|---|---|---|
| profiles 읽기 | active 회원만 | ✅ | active만 | active만 | 전체 |
| profiles 수정 | ❌ | 닉네임·사진·소개 **열만** | ❌ | ❌ | 함수 통해서만(status) |
| profile_private 읽기 | ❌ | ✅ | ❌ | **❌** | ✅ (열람 시 감사 기록 — 관리자 화면은 함수로만 조회) |
| profile_private 수정 | ❌ | 전화·출생연도·관심사 **열만** | ❌ | ❌ | ❌ |
| user_roles 읽기 | ❌ | 본인 것 | ❌ | 본인 것 | 전체 |
| user_roles 추가·수정·삭제 | ❌ | **❌** | ❌ | ❌ | `admin_set_user_role` 함수로만 |
| legal_consents 읽기 | ❌ | 본인 것 | ❌ | ❌ | 전체 |
| legal_consents 추가 | ❌ | 본인 것(함수) | ❌ | ❌ | ❌ |
| audit_logs 읽기 | ❌ | ❌ | ❌ | ❌ | ✅ |
| audit_logs 추가·수정·삭제 | ❌ | ❌ | ❌ | ❌ | 추가는 함수 내부만, 수정·삭제 **누구도 불가** |

### 4-2. 이중 잠금
- **RLS(줄 단위)** + **열 권한(GRANT UPDATE (nickname, avatar_url, bio))** 을 함께 적용 → RLS 정책에 실수가 있어도 status·adult_verified_at 같은 열은 수정 불가.
- 테이블별로 anon/authenticated에 허용할 권한(SELECT/INSERT/UPDATE/DELETE)을 마이그레이션에 명시적으로 적고, 나머지는 회수.

### 4-3. 완료 조건
| | 내용 |
|---|---|
| ✅ | ① `public` 스키마에 RLS 꺼진 테이블 0개 ② 테이블별 허용 권한이 위 표와 정확히 일치 ③ 6-2 부정 테스트 전부 통과 |
| ▶ | pgTAP 테스트(`supabase test db`), 스테이징은 Supabase 대시보드 **Security Advisor** 경고 0건 확인 + `supabase db lint` |
| ◎ | 테스트 통과, Security Advisor "RLS disabled" 경고 없음 |
| ⚠ | 경고·실패 시 해당 정책 수정 마이그레이션 추가, 스테이징 반영 전 CI 재통과 필수 |

---

## 5. 서버 측 권한 검증

| 위치 | 하는 일 |
|---|---|
| `src/proxy.ts` (Next.js 16의 미들웨어) | 로그인 세션 갱신, `/me`·`/host`·`/admin` 비로그인 접근 시 로그인 화면으로 (1차 차단일 뿐 보안의 최종 근거 아님) |
| `src/lib/auth/guards.ts` | `getCurrentUser()`(검증된 토큰), `requireRole('host'|'admin')`(DB 조회), `requireAal2()` |
| `/host`, `/admin` 레이아웃 | 화면 그리기 전 `requireRole` — 실패 시 403 화면 |
| 모든 서버 처리(Server Action) | 입력값 검증(zod) + 권한 재확인 후 DB 호출. 관리자 처리는 DB 함수 호출만 |
| 비밀키(SUPABASE_SECRET_KEY) | **1단계 앱 코드에서는 사용하지 않음.** 테스트 환경 준비용(테스트 계정 생성)으로만 CI에서 사용 |

| | 내용 |
|---|---|
| ✅ | 참가자 계정으로 `/admin`, `/host` 접근 → 403, 관리자 서버 처리 직접 호출 → 거부, MFA 미인증 관리자 → `/admin/mfa`로 이동 |
| ▶ | E2E 테스트 + API 통합 테스트 |
| ◎ | 모두 거부·이동 확인 |
| ⚠ | 화면만 막히고 서버 처리가 허용되면 즉시 수정(가장 심각한 유형) |

---

## 6. 자동 테스트 계획

### 6-1. 테스트 층
| 층 | 도구 | 위치 | 무엇을 |
|---|---|---|---|
| L1 DB | pgTAP (`supabase test db`) | `supabase/tests/database/*.test.sql` | 역할별로 가장한 상태에서 RLS·열 권한·함수 동작. 각 테스트는 트랜잭션 안에서 실행 후 **되돌림(ROLLBACK)** → 데이터 남지 않음 |
| L2 API | vitest + supabase-js | `tests/integration/*.test.ts` | 실제 로그인한 사용자 A·B·호스트·관리자로 외부 API를 직접 호출하는 공격 시나리오 |
| L3 화면 | Playwright | `tests/e2e/*.spec.ts` | 가입·인증 메일·로그인·접근 차단, 브라우저에 실린 JS의 비밀키 검사 |
| L4 단위 | vitest | `tests/unit` | 입력 검증, 환경변수(기존 19개 유지) |

### 6-2. 부정 테스트 목록 (반드시 "거부"되어야 하는 것)
| # | 시나리오 | 층 | 기대 결과 |
|---|---|---|---|
| N1 | 참가자 A가 user_roles에 자기 admin 행 추가 | L1·L2 | 권한 오류 |
| N2 | A가 user_roles의 자기 행을 admin으로 수정 | L1·L2 | 권한 오류 |
| N3 | A가 `admin_set_user_role` 함수를 직접 호출 | L1·L2 | 거부 + 역할 변화 없음 |
| N4 | A가 토큰 메타데이터에 `role: admin` 저장(`updateUser`) 후 관리자 기능 시도 | L2·L3 | 거부, `/admin` 403 |
| N5 | A가 profiles.status를 active로 바꾸기(정지 상태에서) | L1·L2 | 수정 불가 |
| N6 | A가 profile_private.adult_verified_at 수정 | L1·L2 | 수정 불가 |
| N7 | A가 B의 profile_private 조회 | L1·L2 | 0건 |
| N8 | A가 B의 profile_private 수정 | L1·L2 | 0건 변경, B 데이터 그대로 |
| N9 | 호스트 H가 참가자 A의 profile_private 조회 | L1·L2 | 0건 |
| N10 | 비로그인이 profile_private·user_roles·legal_consents·audit_logs 조회 | L1·L2 | 0건 또는 권한 오류 |
| N11 | A가 B의 legal_consents 조회·추가 | L1·L2 | 0건 / 거부 |
| N12 | A가 audit_logs 조회·추가 | L1·L2 | 0건 / 거부 |
| N13 | 관리자(2단계 인증 전, aal1)가 역할 변경·회원 목록 | L1·L2·L3 | 거부, `/admin/mfa`로 이동 |
| N14 | 관리자가 자기 admin 해제 / 마지막 관리자 해제 | L1 | 거부 |
| N15 | 관리자를 포함한 누구든 audit_logs·legal_consents 수정·삭제 | L1 | 거부 |
| N16 | A가 B의 이메일·전화번호를 profiles 경로로 획득 | L2 | profiles 응답에 해당 필드 자체가 없음 |
| N17 | 정지(suspended) 회원의 보호 기능 사용 | L2·L3 | 거부 |
| N18 | public 스키마에 RLS 꺼진 테이블 존재 | L1 | 0개여야 통과 |
| N19 | 브라우저 JS·빌드 결과에 비밀키 패턴(`sb_secret_`, service_role 토큰, `test_sk_`, `live_`) 존재 | L3·스크립트 | 0건이어야 통과 |
| N20 | 결제 모드 `live`로 빌드 | CI | **빌드 실패해야 통과** |

긍정 테스트(허용되어야 하는 것)도 함께: 본인 프로필 조회·수정, 관리자(aal2)의 역할 부여·감사 기록 생성, 동의 기록 추가 등.

### 6-3. 실행 명령
| 명령 | 내용 |
|---|---|
| `npm run test` | 단위 테스트 |
| `npm run test:db` | `supabase test db` (로컬/CI의 임시 Supabase) |
| `npm run test:integration` | API 부정 테스트 (임시 Supabase에 테스트 계정 자동 생성) |
| `npm run test:e2e` | Playwright 화면 테스트 |
| `npm run scan:bundle` | 빌드 결과물 비밀키 검사 |

### 6-4. 4단계(예약) 대비 장치
- 공통 테스트 도구: "사용자 X로 가장하기", "테스트 회원 A·B·호스트·관리자 만들기"를 1단계에서 만들어 두고 예약·결제 테이블 테스트에 재사용.
- **CI 규칙**: `public` 스키마의 모든 테이블은 pgTAP 테스트 파일에서 최소 1회 이상 RLS 부정 테스트 대상이어야 함 → 테스트 없는 새 테이블이 생기면 CI 실패.
- 4단계 부정 테스트 예정 항목(지금은 테이블이 없어 미실행): 다른 회원 예약 조회·취소, 남의 결제 정보 조회, 호스트가 자기 모임이 아닌 예약 조회 등.

---

## 7. 마이그레이션·RLS 테스트 실행 환경

### 7-1. 원칙
1. **검증은 CI의 일회용 Supabase에서 먼저** — GitHub Actions 서버에는 Docker가 있어, 실행할 때마다 깨끗한 Supabase를 띄우고 마이그레이션 적용 → 테스트 → 폐기합니다. 이 개발 환경(Docker 불가)의 한계를 이 방식으로 대체합니다.
2. **스테이징 반영은 CI 통과 후, 창업자 승인 버튼을 눌렀을 때만.**
3. 스테이징에는 실제 회원 데이터를 넣지 않습니다(테스트 계정만). 운영 DB에는 1단계에서 아무것도 하지 않습니다.
4. 원격 DB에 `db reset`(전체 삭제) 명령은 사용하지 않습니다.

### 7-2. 흐름
```
코드 push
  └─ CI 잡 "db-tests" (자동)
       supabase start (임시 DB, 필요한 서비스만)
       → supabase db reset   : 마이그레이션 처음부터 적용 (적용 오류 검사)
       → supabase test db    : pgTAP 테스트
       → 앱 빌드·실행 → test:integration, test:e2e, scan:bundle
       → 종료 시 자동 폐기
  └─ 모두 통과
       └─ 창업자가 GitHub Actions에서 "Deploy DB to staging" 수동 실행
            → GitHub Environment 'staging' 승인 요청 → 창업자 승인
            → supabase db push --dry-run  (적용될 변경 목록 로그 출력)
            → supabase db push            (스테이징에 적용)
            → supabase test db --db-url (스테이징) : pgTAP 재실행, 모두 ROLLBACK되어 데이터 남지 않음
            → supabase db lint
```

### 7-3. 필요한 비밀값 (창업자가 GitHub에 직접 등록, 채팅 공유 금지)
GitHub 저장소 → Settings → Environments → `staging` 만들기 → Required reviewers에 본인 추가 → Environment secrets:
| 이름 | 어디서 |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens |
| `STAGING_PROJECT_REF` | 스테이징 프로젝트 주소의 영문 ID |
| `STAGING_DB_PASSWORD` | 프로젝트 생성 시 정한 DB 비밀번호 |

### 7-4. 대안 (CI를 쓸 수 없을 때)
| 대안 | 방법 | 단점 |
|---|---|---|
| A. 창업자 PC | Docker Desktop 설치 후 `npm run db:start && npm run test:db` | 설치 필요 |
| B. 스테이징 직접 | 스테이징에 마이그레이션 적용 후 pgTAP(ROLLBACK 방식) 실행 | 마이그레이션 오류 시 스테이징을 고쳐야 함 → 스테이징을 "언제든 다시 만들 수 있는" 상태로 유지 |
| C. Supabase Branching | 유료 기능, 변경마다 임시 DB 자동 생성 | 비용 |

→ 추천: **기본 CI 방식**, 막히면 B(스테이징 전용·테스트 데이터만).

### 7-5. 완료 조건
| | 내용 |
|---|---|
| ✅ | CI "db-tests" 잡이 GitHub에서 실제로 성공한 실행 기록 + 스테이징 반영 워크플로 1회 성공 기록(스테이징 준비된 경우) |
| ▶ | GitHub → Actions 탭에서 해당 실행 확인 (보고서에 실행 번호 기재) |
| ◎ | 성공 기록, 스테이징 Table Editor에 1단계 테이블 5개, Security Advisor 경고 0 |
| ⚠ | CI에서 `supabase start` 실패 → 서비스 축소 옵션·버전 고정 / 스테이징 적용 실패 → 원인 로그 보고, 수정 마이그레이션 추가 후 재승인 요청 (적용된 파일을 고치지 않음) |

---

## 8. GitHub Actions 점검

### 8-1. 현재 상태 (정정)
0단계 보고 시점에는 업로드 직후라 실행 기록이 0건이었습니다. **이후 확인 결과 실제로 실행·성공했습니다.**
- 실행 #1 (run id 41562172866, 커밋 `862440a`, push 이벤트): `Lint · Typecheck · Test · Build` 성공, `Secret scan` 성공(gitleaks: 커밋 3개 검사, 유출 없음)
- 주소: https://github.com/jcu4005-ship-it/My-first/actions/runs/41562172866
- 경고 1건: `actions/checkout@v4`가 Node 20 기반(지원 종료 예정) → 1단계에서 최신 버전으로 교체

### 8-2. 워크플로 정보
| 항목 | 값 |
|---|---|
| 파일 경로 | `.github/workflows/ci.yml` |
| 트리거 | 모든 브랜치 push (`branches: ["**"]`), 모든 pull_request |
| 1단계 추가 | 수동 실행(`workflow_dispatch`), `db-tests` 잡, `live` 결제 모드 빌드 실패 확인 단계(N20), 별도 파일 `.github/workflows/deploy-db-staging.yml`(수동 + 승인) |

### 8-3. 실행되지 않을 때 확인 순서
| 순서 | 확인 | 위치 |
|---|---|---|
| 1 | Actions 탭에 "CI" 워크플로가 보이는지, 실행 기록이 있는지 | 저장소 → Actions |
| 2 | Actions 사용 허용 여부 | Settings → Actions → General → Actions permissions: "Allow all actions and reusable workflows" |
| 3 | 워크플로 권한 | 같은 화면 Workflow permissions: "Read repository contents" (현재 파일도 read만 요청) |
| 4 | 비공개 저장소 사용 시간 한도 | 계정 Settings → Billing → Actions 사용량 |
| 5 | 파일 위치·문법 | 경로가 정확히 `.github/workflows/`인지, Actions 탭에 YAML 오류 표시 여부 |
| 6 | 직접 실행 | (1단계 이후) Actions → CI → "Run workflow" |

**보고 원칙**: 각 단계 보고서에 GitHub 실행 번호와 결과를 적고, 실행 기록을 확인하지 못한 경우 "CI 미확인"으로 표시합니다.

---

## 9. Vercel 스테이징 연결

### 9-1. 구성
| 항목 | 설정 | 이유 |
|---|---|---|
| 프로젝트 | Vercel 프로젝트 1개, 이 저장소 연결 | |
| Production Branch | `main` (아직 없음) | **실수로 운영 배포가 생기지 않도록** — 출시 시 main 생성 |
| 스테이징 | 작업 브랜치 push → Preview 배포 = 스테이징. 브랜치 고정 주소(`...-git-<브랜치>-...vercel.app`) 사용 | 주소가 바뀌지 않아 Supabase 리디렉트 설정이 쉬움 |
| 환경변수 범위 | **Preview 범위에만** 스테이징 값 입력. Production 범위는 비워 둠 | 운영 환경과 섞이지 않게 |
| 접근 보호 | Deployment Protection → Vercel Authentication(미리보기 보호) 켜기 | 외부인 접근 차단 |
| 지역 | `vercel.json`의 icn1(서울) | |

### 9-2. Preview(스테이징) 환경변수
| 이름 | 값 | 민감도 |
|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | `staging` | 공개 |
| `NEXT_PUBLIC_PAYMENT_MODE` | `test` | 공개 |
| `NEXT_PUBLIC_SUPABASE_URL` | 스테이징 URL | 공개 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 스테이징 공개 키 | 공개 (브라우저에 보이는 것이 정상, RLS로 보호) |
| `NEXT_PUBLIC_SITE_URL` | 브랜치 고정 주소 | 공개 |
| `SUPABASE_SECRET_KEY` | **넣지 않음** (1단계 앱은 사용 안 함) | — |

나중에 비밀값을 넣을 때는 Vercel의 **Sensitive** 옵션(저장 후 다시 볼 수 없음)으로 등록합니다.

Supabase 스테이징 Auth 설정: Site URL = 브랜치 고정 주소, Redirect URLs = 그 주소의 `/auth/**`.

### 9-3. 비밀키 노출 점검
| # | 점검 | 방법 | 기대 결과 |
|---|---|---|---|
| V1 | 빌드 결과물 | `npm run scan:bundle` — `.next/static` 전체에서 비밀키 패턴·실제 비밀값 검색 (CI 자동) | 0건 |
| V2 | 브라우저 | E2E에서 각 화면이 불러온 JS를 모두 받아 같은 패턴 검색 / 수동: 개발자도구 → Network → JS → 검색 `sb_secret`, `service_role`, `sk_` | 0건 |
| V3 | 빌드 로그 | 환경변수 검증 오류 메시지는 **이름만 출력, 값 미출력** — 단위 테스트로 보장. Vercel 빌드 로그에서 `sb_secret`, `sk_` 검색 | 0건 |
| V4 | 상태 확인 주소 | `/api/health` 응답이 연결 여부(true/false)만 포함 — 테스트로 보장 | 값 없음 |
| V5 | 저장소 | gitleaks (CI 기존) | 유출 없음 |

### 9-4. 완료 조건
| | 내용 |
|---|---|
| ✅ | 스테이징 주소에서 가입·로그인 성공, `/api/health`가 `appEnv: staging`, `paymentMode: test`, `supabase: true`, V1~V5 통과 |
| ▶ | 창업자: Vercel 연결 → 주소 공유 / 개발: CI 결과 + 스테이징 수동 점검 |
| ◎ | 위 값 확인, 비로그인 외부 접속은 Vercel 로그인 화면으로 차단 |
| ⚠ | 빌드 실패 → Vercel 로그의 환경변수 검증 메시지 확인(이름만 표시됨) / 비밀키 노출 발견 → **즉시 Supabase에서 키 교체(roll)**, 재배포, 노출 경위 보고 |

---

## 10. 결제 차단 유지

| | 내용 |
|---|---|
| ✅ | 1단계에서 결제 코드·설정 변경 없음. `live` 모드 빌드 실패가 CI에서 매번 확인됨(N20). 스테이징 `/api/health`의 `paymentMode: test`, `livePaymentsEnabled: false` |
| ▶ | CI N20 단계, 스테이징 health 확인 |
| ⚠ | 어떤 이유로든 live 허용이 필요해 보이면 작업 중단 후 별도 승인 요청 |

---

## 11. 작업 순서와 예상 기간 (약 1.5주, 외부 준비 제외)

| 순서 | 작업 | 의존 |
|---|---|---|
| 1-1 | CI 확장: db-tests 잡, N20, 수동 실행, actions 버전 교체 | — |
| 1-2 | 마이그레이션: 표·트리거·함수·RLS·열 권한 | — |
| 1-3 | pgTAP 테스트(N1~N3, N5~N15, N18 + 긍정) | 1-2 |
| 1-4 | 인증 화면·proxy·guards·동의 | 1-2 |
| 1-5 | 관리자 MFA, 회원 목록·역할 변경(최소 화면) | 1-4 |
| 1-6 | API 통합·E2E·번들 검사(N4, N16, N17, N19) | 1-4, 1-5 |
| 1-7 | 스테이징 DB 반영 워크플로 + 실제 반영 | 창업자 준비 |
| 1-8 | Vercel 스테이징 점검 V1~V5 | 창업자 준비 |
| 1-9 | 카카오 로그인 | 카카오 앱 등록 |
| 1-10 | 1단계 보고서 (실행 번호·테스트 결과·미해결 사항) | 전체 |

외부 준비가 늦어지면 1-1~1-6을 먼저 끝내 CI 기준으로 보고하고, 1-7~1-9는 준비되는 대로 이어서 진행·보고합니다. 이 경우 "스테이징 미검증"을 명시합니다.

---

## 12. 창업자 준비 사항

| # | 할 일 | 필요 시점 | 안내 |
|---|---|---|---|
| P1 | Supabase 스테이징 프로젝트(서울) 생성 | 1-7 | `docs/SETUP.md` 1번 |
| P2 | GitHub Environment `staging` + 비밀값 3개 등록 | 1-7 | 이 문서 7-3 |
| P3 | Vercel 연결(Production Branch=main, Preview 환경변수, 미리보기 보호) | 1-8 | 이 문서 9장 |
| P4 | 카카오 개발자 앱 등록(이메일 동의 항목 사용 가능 여부 확인) | 1-9 | 승인 후 상세 절차 제공 |
| P5 | 최초 관리자 지정용 이메일 결정 | 1-5 | 승인 후 SQL 절차 제공 |

## 13. 결정 요청 (추천안)

| # | 질문 | 추천 |
|---|---|---|
| D1 | 카카오 로그인 시점 | 이메일 로그인 먼저 완성, 카카오는 앱 등록되는 대로 1단계 안에서 추가(미완 시 보고서에 명시) |
| D2 | 닉네임 중복 | 허용 안 함(대소문자 무시) |
| D3 | 만 14세 이상 확인 | 가입 필수 항목 (문구는 법률 검토 대상) |
| D4 | 관리자 2단계 인증 | 필수 (미인증 시 관리자 기능 전체 차단) |
| D5 | 스테이징 DB 반영 승인자 | 창업자 1인 |
| D6 | 회원 탈퇴 | 1단계 제외, 법률 검토(9-4 D4) 후 구현. 그 전에는 운영팀 문의 안내 |
| D7 | 비밀번호 규칙 | 최소 10자 + 영문·숫자 |

---

## 14. 1단계 완료 판정 체크리스트

- [ ] 부정 테스트 N1~N20 전부 통과 (CI 실행 번호 기재)
- [ ] 긍정 테스트 전부 통과
- [ ] RLS 꺼진 테이블 0개, 테이블별 권한 = 4-1 표
- [ ] 이메일 가입·인증·로그인·재설정 E2E 통과
- [ ] 관리자 MFA 없이는 관리자 기능 불가
- [ ] 비밀키 노출 점검 V1~V5 통과
- [ ] `live` 결제 모드 빌드 실패 확인
- [ ] GitHub Actions 실행 기록으로 위 항목 확인 (미확인 시 "미확인" 표기)
- [ ] (준비된 경우) 스테이징 DB 반영·Security Advisor 0건·스테이징 가입 성공
- [ ] (준비된 경우) 카카오 로그인
- [ ] 보고서: 변경 파일, 구현 내용, 실행 방법, 테스트 결과, 미해결 문제
