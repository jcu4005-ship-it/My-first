# 스테이징 환경 연결 가이드 (창업자 계정 작업)

> 스테이징과 운영은 **Supabase 프로젝트·DB·키를 완전히 분리**합니다. 이 문서는 스테이징만 다룹니다.
> 비밀번호·키는 채팅에 붙여 넣지 말고, 각 서비스 설정 화면에만 입력하세요.

## A. Supabase 스테이징 프로젝트

1. supabase.com → New project → 이름 `gathering-staging`, **Region: Northeast Asia (Seoul)**
2. DB 비밀번호는 비밀번호 관리자에 보관
3. **Authentication → Sign In / Providers → Email**
   - Confirm email: **켜기**
   - Secure password change: **켜기**
4. **Authentication → Sign In / Providers → (Password settings)**
   - Minimum password length: **10**
   - Password requirements: **Letters and digits**
5. **Authentication → Multi-Factor → TOTP**: Enroll·Verify **켜기**
6. **Authentication → URL Configuration**
   - Site URL: Vercel 스테이징 고정 주소 (아래 C-3)
   - Redirect URLs: `<스테이징 주소>/**`
7. **Authentication → Emails → Templates**
   - "Confirm signup" 본문의 링크를 `supabase/templates/confirmation.html` 내용으로 교체
   - "Reset password" 본문을 `supabase/templates/recovery.html` 내용으로 교체
   - (링크가 `{{ .SiteURL }}/auth/confirm?token_hash=...` 형식이어야 다른 브라우저에서 열어도 동작)
8. 참고: Supabase 기본 메일 발송은 **프로젝트 팀원 주소로만, 시간당 소량**만 보냅니다. 스테이징 확인은 본인 이메일로 하고, 출시 전 자체 메일 발송(SMTP) 연결이 필요합니다(LAUNCH_BLOCKERS.md).

## B. GitHub — 스테이징 DB 반영 승인 설정

1. 저장소 → **Settings → Environments → New environment** → 이름 `staging`
2. **Required reviewers**: 본인 계정 추가 (이 승인 없이는 스테이징 DB에 반영되지 않음)
3. **Deployment branches**: "Selected branches"로 작업 브랜치만 허용(권장)
4. **Environment secrets** 3개 추가
   | 이름 | 값 위치 |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens → Generate |
   | `STAGING_PROJECT_REF` | 스테이징 프로젝트 주소 `https://supabase.com/dashboard/project/<이 부분>` |
   | `STAGING_DB_PASSWORD` | A-2에서 정한 DB 비밀번호 |
5. (운영 프로젝트를 만든 뒤) 저장소 **Settings → Secrets and variables → Actions → Variables**에 `PRODUCTION_PROJECT_REF` 추가 — 스테이징 반영 작업이 실수로 운영을 가리키면 중단됩니다.

### 반영 실행 (창업자 승인 시점)
1. 저장소 → Actions → **Deploy DB to staging** → Run workflow → 입력란에 `staging`
2. 승인 요청 알림 → 내용 확인 후 **Approve**
3. 로그에서 확인: dry-run 목록 → 적용 → pgTAP 결과(`Result: PASS`) → lint → Auth 설정 확인(`PASS` 5줄)

## C. Vercel 스테이징

1. vercel.com → Add New → Project → 이 저장소
2. **Settings → Git → Production Branch: `main`** (아직 없음 → 운영 배포가 생기지 않음)
3. 작업 브랜치 push 시 생성되는 **Preview 배포 = 스테이징**. 브랜치 고정 주소(`<프로젝트>-git-<브랜치>-<팀>.vercel.app`)를 A-6에 등록
4. **Settings → Environment Variables** — 범위(Environment)를 **Preview만** 선택
   | 이름 | 값 |
   |---|---|
   | `NEXT_PUBLIC_APP_ENV` | `staging` |
   | `NEXT_PUBLIC_PAYMENT_MODE` | `test` |
   | `NEXT_PUBLIC_SUPABASE_URL` | 스테이징 Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 스테이징 publishable(또는 anon) 키 |
   | `NEXT_PUBLIC_SITE_URL` | 브랜치 고정 주소 |
   | `SUPABASE_SECRET_KEY` | 스테이징 Secret key — **Sensitive로 체크**. 테스트 결제 확정·환불 기록에만 서버에서 사용 (없으면 빌드가 실패하도록 되어 있음) |
5. **Settings → Deployment Protection → Vercel Authentication**: Preview 보호 켜기

## D. 확인 절차 (연결 후)

| # | 확인 | 방법 | 기대 결과 |
|---|---|---|---|
| D1 | 환경 | `<스테이징 주소>/api/health` | `appEnv: staging`, `paymentMode: test`, `livePaymentsEnabled: false`, `integrations.supabase: true` |
| D2 | 외부 접근 차단 | 시크릿 창으로 스테이징 주소 접속 | Vercel 로그인 화면 |
| D3 | 가입·인증 | 본인 이메일로 가입 → 메일 링크 | `/me`로 이동, 닉네임 표시 |
| D4 | 비밀번호 규칙 | 가입 시 `abcdefg12`(9자) 입력 | 거부 |
| V2 | 브라우저 비밀키 | 개발자도구 → Network → JS 파일 검색 `sb_secret`, `service_role`, `sk_` | 0건 (publishable 키가 보이는 것은 정상) |
| V3 | 빌드 로그 | Vercel → Deployments → Build Logs 검색 `sb_secret`, `sk_` | 0건 |
| D5 | 최초 관리자 | ADMIN_BOOTSTRAP.md | `/admin` 2단계 인증 후 접근 |

### 비밀키가 노출된 경우
1. Supabase → Project Settings → API Keys → 해당 키 **재발급(roll)** 즉시
2. Vercel 환경변수 교체 → 재배포
3. 노출 범위·경위를 기록하고 보고
