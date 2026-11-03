# 스테이징 배포 (자동화)

스테이징 준비·배포·검증은 GitHub Actions **"Staging deploy & verify"** 가 자동으로 합니다.
창업자가 할 일은 **열쇠 3개를 GitHub에 넣는 것**과 **실행 승인**뿐입니다. 운영 프로젝트는 만들지 않습니다.

## 이미 끝난 것
- Supabase 스테이징 프로젝트 (서울, ref `jgfjsvwlhfqommszeiqk`)
- Vercel 프로젝트 `my-first` 연결, Production Branch = `main`(준비 중 안내 페이지만)

## 창업자 작업: GitHub Environment `staging`
저장소 → Settings → Environments → New environment `staging`
- Required reviewers: 본인 / Deployment branches: 작업 브랜치만
- Environment secrets 3개
  | 이름 | 만드는 곳 |
  |---|---|
  | `SUPABASE_ACCESS_TOKEN` | supabase.com → 오른쪽 위 계정 → Account preferences → Access Tokens → Generate new token |
  | `STAGING_DB_PASSWORD` | 프로젝트 만들 때 정한 DB 비밀번호 (모르면 Project Settings → Database → Reset database password) |
  | `VERCEL_TOKEN` | vercel.com → 오른쪽 위 계정 → Account Settings → Tokens → Create (Scope: 내 팀, 만료 30일 이상) |

## 자동으로 하는 일 (`.github/workflows/staging.yml`)
1. Supabase 공개 키·비밀 키 조회 (비밀 키가 없으면 생성)
2. DB 구조 반영(+처음 한 번 샘플), 원격 pgTAP 권한 테스트, 구조 검사
3. Vercel Preview 환경변수 5개 설정(비밀 키는 Sensitive, Production에는 넣지 않음) → 작업 브랜치 Preview 배포
4. Supabase 로그인 설정(이메일 인증·비밀번호 10자+영문·숫자·TOTP·익명 로그인 끔)·메일 문구·사이트 주소
5. 배포 주소 자동 검증 (우회 값은 스테이징 주소 요청에만, 로그에서 가림)

## 직접 확인 (자동화하지 않음)
1. 본인 이메일로 스테이징 가입 → 실제 인증 메일 → 로그인
2. Supabase SQL Editor: `select private.bootstrap_first_admin('본인이메일', '최초 관리자 지정');`
3. 스테이징 `/admin` → 휴대폰 인증 앱으로 OTP 등록

## 비밀키가 노출된 경우
Supabase → Project Settings → API Keys 해당 키 폐기·재발급, Vercel 토큰 폐기 → 워크플로 재실행
