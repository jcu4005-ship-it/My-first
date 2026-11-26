# 임시 공개("곧 문을 엽니다") 모드

> 운영 DB·결제·메일이 준비되기 전에 도메인(roundi.kr)으로 들어온 사람에게 소개·사업자 정보·약관만 보여 주는 모드. 2026-11-26 구현.

## 켜면 어떻게 되나
| | 임시 공개 모드 (운영 DB 없음) | 임시 공개 모드 + 운영 DB 연결 | 일반 모드 |
|---|---|---|---|
| 메인(/) | "곧 문을 엽니다" 소개 페이지 | 같음 | 실제 메인 |
| 이용약관·개인정보·환불 | 열림 | 열림 | 열림 |
| 크리에이터 지원(/apply) | 닫힘 → 이메일 문의 안내 | **열림** (지원 접수·관리자 확인) | 열림 |
| 관리자 로그인·화면 | 닫힘 | 열림 (2단계 인증은 그대로) | 열림 |
| 회원가입·프로그램·결제·호스트·마이페이지 | 닫힘 → 소개 페이지로 이동 | 닫힘 | 열림 |

- 규칙은 `src/lib/site-mode.ts`, 적용은 `src/proxy.ts`, 소개 화면은 `src/app/coming-soon/page.tsx`
- 머리글·바닥글은 이 모드에서 메뉴·로그인이 없는 간단한 버전
- 검색에 올리지 않음(noindex) — 정식 오픈 때 켜기
- 운영 배포 승인 장치(`ALLOW_PRODUCTION_DEPLOY=approved`)는 **그대로 필요**합니다. 임시 공개 모드가 풀어 주는 것은 "운영에서도 Supabase 설정이 필수"라는 검사 하나뿐

## Vercel 운영(Production) 환경변수 (Settings → Environment Variables, 범위: **Production만**)
| 이름 | 값 |
|---|---|
| `NEXT_PUBLIC_APP_ENV` | `production` |
| `NEXT_PUBLIC_SITE_URL` | `https://roundi.kr` |
| `SITE_MODE` | `coming_soon` |
| `ALLOW_PRODUCTION_DEPLOY` | `approved` |

- Supabase 키(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`)는 **운영 DB가 만들어진 뒤에** 넣습니다. 넣으면 /apply와 관리자가 열립니다.
- **스테이징 DB 키를 운영에 넣지 마세요.** (실제 지원자 개인정보가 시험 DB에 쌓임)

## 도메인 연결 순서 (대표가 직접)
1. **Vercel**: 프로젝트 → Settings → Domains → `roundi.kr` 추가. Vercel이 필요한 DNS 값(A 레코드, www용 CNAME)을 보여 줍니다. → **그 값을 그대로** 사용
2. **가비아(구입처)**: 도메인 관리 → DNS 설정(레코드 추가)에 1번 값을 입력. 네임서버는 바꾸지 않아도 됩니다.
3. 몇 분~몇 시간(최대 하루) 뒤 `https://roundi.kr` 에서 소개 페이지가 보이면 완료
4. 운영(Production) 배포가 있어야 도메인이 보여 줄 것이 생깁니다 → 아래 "운영 배포" 참고

## 운영 배포 (확인 필요)
- Vercel의 Production은 보통 **저장소의 기본 브랜치(main)** 를 배포합니다. 지금 main에는 이 코드가 없습니다.
- 방법 A: 작업 브랜치를 main에 합치기(PR) — 정식 방식. (요청하시면 만듭니다)
- 방법 B: Vercel → Settings → Git → Production Branch를 작업 브랜치로 바꾸고 배포
- 배포가 끝나면 Vercel Deployments에서 Production 배포가 **Ready**인지 확인

## 끄는 법 (정식 오픈 때)
1. 운영 DB·메일·PG 준비 완료, Supabase 환경변수 입력
2. Vercel Production 환경변수에서 `SITE_MODE` 삭제 → 다시 배포
3. noindex 제거는 `src/app/coming-soon/page.tsx` 삭제 또는 일반 모드로 충분 (메인이 실제 화면으로 바뀜)

## 확인 방법 (이 모드로 직접 띄워서 시험)
- 운영 DB 없음: `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= SUPABASE_SECRET_KEY= NEXT_PUBLIC_APP_ENV=production NEXT_PUBLIC_SITE_URL=https://roundi.kr SITE_MODE=coming_soon` 로 빌드·실행 후 `TEST_COMING_SOON=1 npx playwright test tests/e2e/coming-soon.spec.ts`
- 단위 테스트: `tests/unit/site-mode.test.ts` (열림·닫힘 규칙, 운영 환경 검사)
