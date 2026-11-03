# Gathering (가칭) — 호스트 기반 오프라인 커뮤니티 플랫폼

> 서비스명은 가칭입니다. 브랜드 정보는 `src/config/brand.ts` 한 곳에서 관리합니다.

## 현재 상태

| 단계 | 상태 |
|---|---|
| 설계 | ✅ v1.0 확정 — [docs/PLATFORM_DESIGN.md](docs/PLATFORM_DESIGN.md) |
| 0단계 기반 준비 | ✅ 코드 완료, 외부 서비스(Supabase·Vercel) 연결은 계정 생성 후 진행 — [보고서](docs/progress/STAGE-0.md) |
| 1단계 회원·권한 | ⏳ 대기 |

- 결제: **테스트 모드만 허용**. 실결제(live) 설정은 빌드 단계에서 차단됩니다.
- 정산: 관리자 수동 확인 방식만 설계. 자동 정산은 구현하지 않습니다.

## 실행 방법 (개발자용)

```bash
npm install
cp .env.example .env.local   # 값 채우기 (비워 두어도 0단계 화면은 실행됨)
npm run dev                  # http://localhost:3000
```

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run check` | 코드 검사 + 타입 검사 + 자동 테스트 |
| `npm run build` | 배포용 빌드 (환경변수 검증 포함) |
| `npm run db:start` | 로컬 Supabase 실행 (Docker 필요) |

상태 확인 주소: `/api/health` — 환경, 결제 모드, 외부 연결 여부(값 제외)를 보여 줍니다.

외부 서비스 연결 방법은 [docs/SETUP.md](docs/SETUP.md)를 참고하세요.

## 폴더 구조

```
src/app/            화면과 서버 처리
src/config/         브랜드·환경변수 검증·정책 잠금값
src/components/     화면 구성요소 (ui/ = shadcn/ui)
src/lib/supabase/   DB 연결
supabase/           로컬 DB 설정, (1단계부터) DB 구조 변경 이력
tests/unit/         자동 테스트
docs/               설계안, 단계별 보고서
```
