# 스테이징 배포 체크리스트 (창업자 계정 작업)

> 스테이징 전용입니다. **운영 Supabase 프로젝트는 만들지 마세요.** 키·비밀번호는 채팅·코드에 붙여 넣지 말고 각 서비스 화면에만 입력하세요.
> 코드가 요구하는 이름과 이 문서의 이름은 일치하도록 관리합니다 (`src/config/env.ts`, `.github/workflows/*.yml`).

## 순서 요약
A. Supabase 프로젝트 → B. Vercel 연결(첫 배포는 일부러 실패) → C. GitHub 설정 → D. 알려 주기 → (자동) DB 반영·배포·검증 → E. 직접 확인

---

## A. Supabase (supabase.com)
1. **New project**: 이름 `gathering-staging`, Region **Northeast Asia (Seoul)**, DB 비밀번호 생성 후 비밀번호 관리자에 보관
2. **Authentication → Sign In / Providers → Email**
   - Confirm email **켜기**, Secure password change **켜기**
   - Minimum password length **10**, Password requirements **Letters and digits**
     (항목이 보이지 않으면 **Authentication → Attack Protection** 쪽에 있습니다)
3. **Authentication → Multi-Factor → TOTP (App authenticator)**: **Enabled**
4. **Authentication → Emails → Templates**
   - **Confirm signup**: 본문을 저장소 `supabase/templates/confirmation.html` 내용으로 교체
   - **Reset password**: 본문을 `supabase/templates/recovery.html` 내용으로 교체
5. 값 위치만 확인 (입력은 B·C에서)
   | 값 | 위치 |
   |---|---|
   | Project URL | Project Settings → Data API (또는 API) |
   | Publishable key | Project Settings → API Keys |
   | Secret key | Project Settings → API Keys → Secret keys (없으면 새로 생성) |
   | Project ref | 대시보드 주소 `supabase.com/dashboard/project/<여기>` |
   | Access token | 오른쪽 위 계정 → Account preferences → Access Tokens → Generate |

## B. Vercel (vercel.com)
1. **Add New → Project → GitHub `My-first` Import**
   - Framework: Next.js (자동), 나머지 기본값
   - **가져오자마자 생기는 첫 배포는 실패하는 것이 정상입니다.** 운영(Production) 배포를 코드에서 막고 있기 때문입니다.
2. **Settings → Git → Production Branch**: `main` 입력 후 Save (아직 없는 브랜치 → 운영 배포가 생기지 않음)
3. **Settings → Environment Variables**: 아래 5개를 **Environment = Preview만** 체크해서 추가 (Production·Development는 체크 해제)
   | 이름 | 값 | 비고 |
   |---|---|---|
   | `NEXT_PUBLIC_APP_ENV` | `staging` | |
   | `NEXT_PUBLIC_PAYMENT_MODE` | `test` | |
   | `NEXT_PUBLIC_SUPABASE_URL` | A-5 Project URL | |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | A-5 Publishable key | 브라우저에 보여도 되는 키 |
   | `SUPABASE_SECRET_KEY` | A-5 Secret key | **Sensitive 체크**. 테스트 결제 확정·환불 기록에만 서버에서 사용 |
4. **Settings → Deployment Protection**
   - Vercel Authentication: **Standard Protection**(미리보기 보호) 켜져 있는지 확인
   - **Protection Bypass for Automation → Add** → 생성된 값 복사 (C-2에 입력, 자동 검증 전용)

## C. GitHub (저장소 Settings → Environments)
1. **New environment `staging`** — 스테이징 DB 구조 변경용
   - Required reviewers: **본인** 체크 → Save protection rules
   - Deployment branches and tags: Selected branches → `claude/community-platform-design-8lg04x`
   - Environment secrets 3개
     | 이름 | 값 |
     |---|---|
     | `SUPABASE_ACCESS_TOKEN` | A-5 Access token |
     | `STAGING_PROJECT_REF` | A-5 Project ref |
     | `STAGING_DB_PASSWORD` | A-1 DB 비밀번호 |
2. **New environment `staging-verify`** — 배포된 사이트 자동 검증용 (승인 없음, DB 비밀번호 없음)
   - Deployment branches: 위와 같이 작업 브랜치만
   - Environment secrets 2개
     | 이름 | 값 | 사용 목적 |
     |---|---|---|
     | `STAGING_SUPABASE_SECRET_KEY` | A-5 Secret key | 인증 완료 상태의 테스트 계정(stg…) 생성, 테스트용 관리자 권한 부여·회수 |
     | `VERCEL_AUTOMATION_BYPASS_SECRET` | B-4 값 | 스테이징 주소로 가는 자동 검증 요청에만 사용 |
   - Environment variables 3개 (비밀 아님)
     | 이름 | 값 |
     |---|---|
     | `STAGING_SUPABASE_URL` | A-5 Project URL |
     | `STAGING_SUPABASE_PUBLISHABLE_KEY` | A-5 Publishable key |
     | `STAGING_APP_URL` | D에서 확정 (스테이징 주소) |

## D. 알려 주기
"설정 완료"라고만 알려 주세요. 이후 진행:
1. 제가 작업 브랜치에 커밋을 올리면 Vercel이 **Preview(스테이징)** 를 배포합니다.
2. 배포 화면 **Domains**의 브랜치 고정 주소(`…-git-claude-…vercel.app`)를
   - Supabase **Authentication → URL Configuration**: Site URL = 그 주소, Redirect URLs = `그 주소/**`
   - GitHub `staging-verify` 변수 `STAGING_APP_URL` = 그 주소
   에 넣어 주세요. (주소는 비밀이 아니므로 채팅으로 알려 주셔도 됩니다)
3. 제가 **Deploy DB to staging**(샘플 포함)을 실행하면 GitHub에서 승인 요청이 옵니다 → Actions의 해당 실행 → **Review deployments → Approve**
4. 제가 **Verify staging site**를 실행해 배포된 주소에서 자동 검증합니다.

## E. 직접 확인 (자동화하지 않는 항목)
1. 본인 이메일로 스테이징에서 가입 → **실제 인증 메일** 수신 → 링크 클릭 → 로그인
2. Supabase **SQL Editor**에서 최초 관리자 지정:
   `select private.bootstrap_first_admin('본인이메일', '최초 관리자 지정');`
3. 스테이징 `/admin` 접속 → 휴대폰 인증 앱으로 **OTP 등록** → 관리자 화면 접근

## 비밀키가 노출된 경우
Supabase → Project Settings → API Keys → 해당 키 폐기·재발급 → Vercel·GitHub 값 교체 → 재배포
