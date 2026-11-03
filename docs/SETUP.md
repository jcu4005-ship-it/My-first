# 외부 서비스 연결 가이드 (창업자용)

0단계 코드는 외부 서비스 없이도 실행됩니다. 아래는 **스테이징(검수용)과 운영 환경을 실제로 띄우기 위해** 창업자님 계정으로 해 주셔야 하는 일입니다. 비밀번호·키는 채팅이나 코드에 붙여 넣지 말고, 각 서비스의 설정 화면에만 입력해 주세요.

## 1. Supabase 프로젝트 2개 만들기 (스테이징 / 운영)

1. https://supabase.com 가입 → **New project**
2. 이름: `gathering-staging` (운영용은 나중에 `gathering-prod`)
3. **Region: Northeast Asia (Seoul)** 선택 — 개인정보 국외 이전 이슈를 줄이기 위해 (설계안 9-4 D3)
4. DB 비밀번호는 비밀번호 관리자에 보관 (공유 금지)
5. 생성 후 **Project Settings → API** 에서 아래 두 값을 확인
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key(또는 anon key) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key(또는 service_role)는 **아직 입력하지 않습니다** (필요한 단계에서 안내)

## 2. Vercel 프로젝트 연결

1. https://vercel.com 가입(GitHub 계정으로) → **Add New → Project** → 이 저장소 선택
2. Framework: Next.js (자동 인식)
3. **Settings → Environment Variables** 에 입력
   | 이름 | Preview(스테이징) | Production(운영) |
   |---|---|---|
   | `NEXT_PUBLIC_APP_ENV` | `staging` | `production` |
   | `NEXT_PUBLIC_PAYMENT_MODE` | `test` | `test` (실결제 승인 전까지) |
   | `NEXT_PUBLIC_SUPABASE_URL` | 스테이징 값 | 운영 값 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 스테이징 값 | 운영 값 |
   | `NEXT_PUBLIC_SITE_URL` | (선택) | 운영 도메인 |
4. 배포 후 `https://<주소>/api/health` 에서 `"integrations": {"supabase": true}` 확인
5. 함수 실행 지역은 `vercel.json`에서 서울(icn1)로 지정되어 있습니다.

> 운영(Production) 환경은 사이트 주소·Supabase 값이 없으면 빌드가 실패하도록 되어 있습니다. 운영 프로젝트는 출시 전에 만들어도 됩니다.

## 3. 토스페이먼츠 (4단계 전까지)

- 개발자센터 가입 후 **테스트 키**(test_ck_…, test_sk_…)만 발급
- 실제(live) 키는 계약·정산 구조 확인(설계안 9-1) + 승인 전까지 발급·입력하지 않습니다. 코드가 live 키를 거부합니다.

## 4. 로컬 DB (개발자용, 1단계부터)

- Docker Desktop 설치 → `npm run db:start` → 로컬 Supabase 실행
