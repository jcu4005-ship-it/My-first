# GATHERING 호스트 생태계 — PROMPT 1 진단 + PROMPT 2 설계 보고서 (2026-11-09)

> 진단·설계 단계에서는 코드·DB를 바꾸지 않았다. 아래 "결정 사항"이 확정된 뒤 단계별로 구현한다.
> 쉬운 말 요약은 각 장 맨 위 "한 줄 요약"에 있다.

---

# PART 1. 현재 프로젝트 진단 (PROMPT 1)

## 1. 현재 프로젝트 구조
**한 줄 요약:** 최신 Next.js + Supabase + Vercel 구조이고, 화면·DB·테스트가 잘 나뉘어 있어 "덧붙여 확장"하기 좋은 상태다.

| 항목 | 현재 |
|---|---|
| 프레임워크 | Next.js **16.4.4** (App Router, React 19.3), TypeScript, `proxy.ts`(예전 middleware 역할)로 권한·404 처리 |
| 스타일 | Tailwind v4 + 직접 만든 shadcn 방식 컴포넌트(Button·Input·Label), 디자인 토큰 `globals.css` (espresso·sand·terracotta·olive) |
| 글꼴 | Pretendard(본문) + Noto Serif KR(제목) |
| 인증 | Supabase Auth (이메일·비밀번호, PKCE, 이메일 인증), `@supabase/ssr` 서버 세션, 관리자 2단계 인증(OTP) |
| DB | Supabase Postgres 17, **모든 테이블 RLS**, 민감 작업은 DB 함수(security definer)로만 |
| 배포 | Vercel: Preview = 스테이징(보호 켜짐), Production(main) = "준비 중" 정적 화면 고정 |
| 자동 검사 | 단위(vitest) 40, 통합 28, DB 권한(pgTAP) 8파일, 화면(Playwright) 20, 번들 비밀키 검사, GitHub Actions(CI + 승인형 스테이징 워크플로) |
| 주요 폴더 | `src/app`(화면), `src/components`(meetups·forms·ui·media), `src/lib`(auth·meetups·hosting·bookings·payments·validation), `supabase/migrations`(6개), `supabase/tests`, `tests/{unit,integration,e2e}` |

## 2. 현재 구현된 기능 (화면별 상태)
범례: ① 정상 작동(자동 검사 통과) ② 화면만 ③ 일부 기능 ④ 미구현

| 화면 | 경로 | 상태 | 비고 |
|---|---|---|---|
| 홈페이지 | `/` | ① | 히어로, 전시장 갤러리, 인기 클래스, 전문가, 커뮤니티 소개, 호스트 모집 |
| 프로그램(클래스) 목록 | `/meetups` | ① | 공개·활성 분야만, 분야 탭 |
| 카테고리 페이지 | `/meetups?category=…` | ① | 별도 경로 없이 필터로 동작 |
| 프로그램 상세 | `/meetups/[id]` | ① | 호스트·배우는 것·커리큘럼·일정 선택·신청 |
| 결제 | `/checkout/[bookingId]` | ① (테스트 모드) | 실결제 잠금. 예전 디자인 |
| 호스트 목록 | `/experts` | ① | 승인된 호스트만. **필터·검색 없음** |
| 호스트 상세 | `/hosts/[id]` | ① | 소개·경력·자격·포트폴리오 링크·클래스. **팔로우·콘텐츠·작업 철학·이미지 없음** |
| 호스트 안내 | `/for-hosts` | ① | 정책·과정·약속·로드맵 |
| 호스트 지원 | `/host/apply` | ① | 경력 필수. **임시 저장·수정 요청·기획안·연락처·동의 없음** |
| 호스트 관리 | `/host`, `/host/meetups/*` | ① | 클래스 작성·일정·참가자·취소. 예전 디자인 |
| 로그인·가입 | `/login`, `/signup` 등 | ① | 이메일 인증·비밀번호 재설정 포함 |
| 마이페이지 | `/me`, `/me/bookings`, `/me/notifications`, `/me/withdraw` | ① | **팔로우·지원 상태·활동 내역 없음** |
| 관리자 | `/admin`, `/admin/hosts`, `/admin/meetups`, `/admin/members`, `/admin/audit` | ① | 호스트 승인·반려, 클래스 검수, 역할, 감사 기록. **수정 요청·콘텐츠 검토·호스트 비활성화 없음** |
| 콘텐츠(저널) | — | ④ | 없음 |
| 팔로우 | — | ④ | 없음 |
| 후기 | — | ④ | 없음 |
| 멤버십 | — | ④ | 없음 |

## 3. 기존 데이터베이스 구조
**한 줄 요약:** 요청하신 데이터 중 회원·프로필·클래스·분야·호스트·예약·결제·관리자는 **이미 있고**, 후기·콘텐츠·팔로우·지원서(이력)는 **없다.**

| 요청 데이터 | 현재 테이블 | 재사용 판단 |
|---|---|---|
| 회원 | `auth.users` + `profiles`(닉네임·avatar_url·bio·status) | ✅ 그대로 |
| 사용자 프로필(비공개) | `profile_private`(연락처 등, 본인만) | ✅ 그대로 |
| 프로그램·클래스 | `meetups` + `meetup_sessions`(회차) | ✅ 그대로 (이름은 meetups 유지) |
| 카테고리 | `categories`(slug·name·활성 여부) | ✅ 재사용 + **상위 분류(pillar) 추가** |
| 호스트 | `host_profiles`(공개 프로필 + 지금은 지원서 역할까지 겸함) | ✅ 공개 프로필로 재사용, **지원서는 분리** 제안 |
| 역할·관리자 | `user_roles`(participant·host·admin) + 관리자 2단계 인증 | ✅ 그대로 |
| 예약·결제 | `bookings`, `payments`, `payment_events` | ✅ 손대지 않음 |
| 알림 | `notifications` | ✅ 재사용 가능 (심사 결과 알림) |
| 감사 기록 | `audit_logs` | ✅ 심사·콘텐츠 승인 기록에 재사용 |
| 동의 | `legal_consents` | ✅ 지원서 자료 이용 동의에 재사용 가능 |
| 후기 | 없음 | ➕ (이번 MVP 범위 밖) |
| 콘텐츠 | 없음 | ➕ 새로 |
| 팔로우 | 없음 | ➕ 새로 |
| 지원서(상태·이력) | `host_profiles.status` 안에 섞여 있음 | ➕ 분리 제안 |

## 4. 재사용 가능한 코드와 컴포넌트
- 디자인: `globals.css` 토큰, `Button`, `eyebrow`/`section-dark`, `EditorialCover`(사진 없을 때 표지), `Photo`(사진 자리), `MeetupCard`/`MeetupGrid`, `CategoryChips`(→ 3대 분류 탭으로 확장), 전시장 갤러리, 휴대폰 넘김 줄
- 폼: `Field`, `TextareaField`, `SelectField`, `FormMessage`, 서버 액션 + zod 검증 패턴
- 데이터: `lib/meetups/queries.ts`(목록·상세·호스트), `lib/hosting/queries.ts`(내 프로필·신청 목록), `getCurrentMember`, `requireRole`, `rpcErrorMessage`
- 관리자: `/admin/(secure)` 레이아웃(2단계 인증 강제), 승인·반려 폼, 감사 기록 화면
- 테스트: pgTAP 도우미(`login_as`, `create_member`), E2E 픽스처(`createMember`, `makeApprovedHost`, 관리자 OTP)

## 5. 새로 추가해야 할 기능 (MVP 기준)
1. 3대 분류 **Knowledge / Creators / Experts** (+ 기존 분야는 세부 주제로)
2. 호스트 목록 `/hosts`: 분류 필터·검색·추천 호스트
3. 호스트 상세 확장: 이미지, 작업 철학, 발행 콘텐츠, 진행 중/예정 프로그램 구분, 팔로우
4. 호스트 지원서 분리: 임시 저장, 상태 6단계, 기획안, 연락처, 동의, 수정 요청 메모
5. 관리자: 수정 요청, 지원서 상세, 콘텐츠 검토·공개, 호스트 비활성화·이력
6. 팔로우: 팔로우/취소, 내 팔로우 목록, 팔로우한 호스트 소식
7. 콘텐츠: Article / Interview / Portfolio, `/journal`, 승인 후 공개
8. 마이페이지 확장: 팔로우, 지원 상태, 활동 내역
9. 홈 재구성: 3대 분류 전시, 이번 주 추천, Featured Hosts, 최신 콘텐츠, 큐레이션 기준, Membership(준비 중 표시)

## 6. 변경하면 안 되는 부분
- 로그인·가입·이메일 인증·비밀번호 재설정·탈퇴 흐름
- 예약·테스트 결제·환불·호스트 취소 DB 함수(`book_session`, `confirm_payment`, `refund_booking`, `cancel_booking`, `host_cancel_session`)
- 관리자 2단계 인증과 `proxy.ts`의 403/404 처리
- 기존 주소: `/meetups`, `/meetups/[id]`, `/hosts/[id]`, `/experts`, `/host/*`, `/for-hosts` → 바꾸더라도 **옛 주소는 새 주소로 연결(리디렉트)**
- 실결제·운영 배포 잠금, 비밀키 비노출, 샘플 데이터 표시
- 기존 테이블·열 삭제·이름 변경 금지 (추가만)

## 7. 예상되는 기술적 위험
| 위험 | 설명 | 대응 |
|---|---|---|
| 지원서 분리 시 기존 흐름 깨짐 | 지금 `apply_host` 함수·관리자 승인·E2E가 `host_profiles.status='applied'`에 의존 | 새 `host_applications`로 옮길 때 기존 신청 데이터를 마이그레이션으로 옮기고, 승인 시 `host_profiles`를 만드는 방식으로 바꾼 뒤 테스트를 같은 커밋에서 갱신 |
| 분류 체계 이중화 | "카테고리"가 상위(3대)와 세부(사진 등) 두 뜻이 됨 | 세부 분야 1개가 상위 분류 1개에 속하게 **한 곳에서만** 정의 (`categories.pillar`) |
| 이미지 | 지금 사진 업로드 기능·저장소 없음 | Supabase Storage 버킷 + 용량·형식 제한 + RLS (인프라 추가, 승인 필요) 또는 MVP는 https 주소 입력 |
| 콘텐츠 보안 | 글에 HTML이 들어가면 악성 코드 위험 | MVP는 **일반 텍스트(문단)만**, HTML 저장·렌더링 금지 |
| 탈퇴 처리 누락 | 새 테이블(지원서·콘텐츠·팔로우)에 개인정보가 남을 수 있음 | `withdraw_my_account`에 새 테이블 정리 추가 + pgTAP |
| 운영 부담 | 지원서·콘텐츠 심사가 모두 수동 | 콘텐츠는 처음엔 호스트·운영팀만 작성 (아래 결정 사항 6) |
| 범위 | 7개 기능 동시 개발 시 회귀 위험 | 기능 단위로 나눠 각각 테스트·스테이징 검증 |

## 8. 권장 개발 순서
1. 분류 체계 + `/hosts` 목록(필터·검색) — DB 변경 작음, 눈에 보이는 변화 큼
2. 호스트 프로필 확장 + 상세 페이지 개편 (slug, 작업 철학, 대표 분류, 추천 여부, 이미지)
3. 지원서 분리 + 새 지원 흐름(임시 저장·6단계 상태) + 관리자 수정 요청
4. 팔로우 + 마이페이지 확장
5. 콘텐츠(저널) + 관리자 콘텐츠 검토 + 호스트 페이지 연결
6. 홈 재구성
7. 관리자 보강(호스트 비활성화·이력)

---

# PART 2. 호스트 생태계 설계 (PROMPT 2)

## 1. 분류 체계: Knowledge / Creators / Experts
**한 줄 요약:** 기존 세부 분야(사진·음악 등)는 그대로 두고, 각 분야가 3대 분류 중 하나에 속하게 만든다. 클래스는 세부 분야만 고르면 3대 분류가 자동으로 정해진다.

- DB: `categories`에 `pillar` 열 추가 (`knowledge` | `creators` | `experts`)
- 클래스(`meetups`)는 지금처럼 세부 분야 하나를 가짐 → 3대 분류는 자동 (중복 저장 없음)
- 호스트(`host_profiles`)에 `primary_pillar` 추가 → `/hosts` 필터용 (활동 분야가 여러 개여도 대표 하나)

**기존 분야 → 3대 분류 매핑 제안 (승인 필요)**
| 세부 분야 | 제안 분류 | 비고 |
|---|---|---|
| 사진·영상, 드로잉·공예, 악기·보컬, 글쓰기 | **Creators** | |
| 커리어·실무 | **Experts** | |
| 커피·티·향, 요리·베이킹 | Creators *(또는 Experts)* | "Food & Drink" 성격 — 결정 필요 |
| 자세·운동 | Experts *(또는 보류)* | 결정 필요 |
| 철학·인문, 독서 (현재 비활성) | **Knowledge** | 클래스 형식으로 다시 열기 (문화·예술 확장 방향과 일치) |
| 심리, 경제·사회, 사고법 | **Knowledge** | 새 세부 분야로 추가 |
| 와인 | 잠금 유지 | 주류 법률 검토 전 |

## 2. 역할 설계 (고정 등급이 아니라 겹칠 수 있는 상태)
| 역할 | 어떻게 정해지나 | 새 DB |
|---|---|---|
| Participant | 가입하면 자동 (`user_roles.participant`, 이미 있음) | 없음 |
| Contributor | 콘텐츠를 1개 이상 **제출**한 회원 (데이터로 판별) | 없음 (`contents`로 계산) |
| Host Candidate | `host_applications`에 진행 중 신청이 있는 회원 | `host_applications` |
| Selected Host | `user_roles.host` + `host_profiles.status = approved` (이미 있음) | 없음 |
| Admin | `user_roles.admin` + 2단계 인증 (이미 있음) | 없음 |

- 한 사람이 동시에 Participant + Contributor + Host일 수 있다.
- 두 경로 모두 같은 지원서로: ① 참가자가 활동 후 지원 ② 외부 전문가가 바로 지원. ③ **운영팀 추천**은 관리자가 초대 표시(`invited_by`)를 단 지원서를 만들어 주는 방식.

## 3. 호스트 ↔ 프로그램
- 호스트 1명 : 프로그램 여러 개 — 이미 그렇게 동작 (`meetups.host_id`).
- 공동 진행자: **MVP에서는 만들지 않는다.** 나중에 `meetup_cohosts(meetup_id, host_id, role)`로 추가 (정산·취소 책임이 복잡해지므로 별도 설계).
- 호스트 페이지의 "진행 중" = 지금 모집 중인 회차가 있는 공개 프로그램, "예정" = 다음 일정이 7일 이후인 프로그램 (같은 데이터에서 계산).

## 4. 호스트 프로필 (공개)
`host_profiles` 재사용 + 추가 열:
| 열 | 용도 |
|---|---|
| `slug` (고유) | `/hosts/[slug]` 주소. 옛 `/hosts/[id]`는 새 주소로 연결 |
| `primary_pillar` | 대표 분류 |
| `occupation` | 직업·전문 분야 한 줄 |
| `philosophy` | 작업 철학 |
| `avatar_url` | 프로필 이미지 (아래 결정 사항 4) |
| `is_featured`, `featured_order` | **운영팀이 직접 고른** 추천 호스트 (팔로워 수와 무관) |

- 팔로워 수는 상세 페이지에 작게만 표시하고, **정렬·추천에 쓰지 않는다.**
- 기존 경력·자격·포트폴리오 링크·가르친 경험은 그대로 사용.

## 5. 호스트 지원서 (`host_applications`, 새 테이블)
**한 줄 요약:** 지원서는 "공개 프로필"과 분리해서 따로 보관한다. 승인되는 순간 공개 프로필이 만들어진다.

| 필드 | 내용 |
|---|---|
| `id`, `applicant_id` | 지원자 |
| `status` | draft → submitted → reviewing → revision_requested → approved / rejected |
| `display_name`, `contact_phone` | 이름·연락처 (**연락처는 본인·관리자만**) |
| `pillar`, `fields[]` | 지원 분류·활동 분야 |
| `bio`, `career`, `credentials`, `portfolio_links[]` | 소개·경력·자격·링크 (https만) |
| `program_proposal` | 프로그램 기획안 (제목·대상·커리큘럼 요약·가격 희망) |
| `value_to_participants` | 참가자에게 줄 가치 |
| `preferred_format` | 희망 운영 방식 (원데이·시리즈·장소 필요 여부) |
| `consented_at` | 제출 자료 이용·개인정보 동의 시각 |
| `review_note`, `reviewed_by`, `reviewed_at` | 관리자 메모 |
| `invited_by` | 운영팀 추천일 때 |
| `submitted_at`, `created_at`, `updated_at` | |

- **중복 방지:** 한 회원당 "진행 중"(draft·submitted·reviewing·revision_requested) 지원서는 1개만 (부분 고유 인덱스). 반려 후에는 새로 지원 가능, 옛 지원서는 이력으로 남음.
- 상태 변경은 **DB 함수로만**: 지원자 `submit`(draft/revision_requested → submitted), 관리자 `start_review`·`request_revision`(메모 필수)·`approve`·`reject`(메모 필수). 모두 감사 기록 + 알림.
- 승인 시: `host_profiles`를 만들거나 갱신(approved) + `user_roles.host` 부여 — 지금 승인 함수와 같은 결과.
- 기존 데이터 이전: 현재 `host_profiles.status='applied'`인 신청은 `host_applications(submitted)`로 옮기는 마이그레이션.
- 임시 저장: **필요** — 기획안이 길어서 한 번에 쓰기 어렵다. draft 상태로 저장.

## 6. 콘텐츠 (`contents`, 새 테이블)
| 필드 | 내용 |
|---|---|
| `id`, `slug` (고유) | `/journal/[slug]` |
| `type` | article / interview / portfolio |
| `author_id` | 작성 회원 |
| `host_id` (선택) | 연결된 호스트 (인터뷰 대상 포함) |
| `related_meetup_id` (선택) | 관련 프로그램 링크 |
| `title`, `excerpt`, `body` | **일반 텍스트**(문단 구분만), HTML 금지 |
| `cover_image_url` | 이미지 (결정 사항 4와 동일 방식) |
| `status` | draft / submitted / published / rejected |
| `review_note`, `reviewed_by`, `published_at` | |

- 공개 조회: `published`만. 작성자는 자기 draft·submitted·rejected를 보고 수정(draft·rejected일 때만).
- 공개(published)·반려는 **관리자 DB 함수로만** + 감사 기록.
- "Portfolio" 유형이 포트폴리오 역할을 하므로 **`host_portfolios` 테이블은 따로 만들지 않는다** (중복 방지).

## 7. 팔로우 (`follows`, 새 테이블)
- `(follower_id, host_id)` 기본키 → **중복 팔로우 불가**
- 본인 팔로우 목록만 조회 가능 (누가 누구를 팔로우하는지 비공개)
- 호스트별 팔로워 수는 숫자만 공개하는 DB 함수로 제공
- 승인된 호스트만 팔로우 가능, 자기 자신은 불가
- 마이페이지 "팔로우한 호스트 소식": 팔로우한 호스트의 최근 공개 프로그램·콘텐츠 목록 (실시간 알림 없음)

## 8. 관리자
| 기능 | 현재 | 추가 |
|---|---|---|
| 호스트 지원 목록 | ✅ | 상태별 탭, 지원서 상세 화면 |
| 승인·반려 | ✅ | **수정 요청 + 메모**, 심사 시작 |
| 호스트 프로필 관리 | ❌ | 추천 지정, slug·대표 분류 수정 |
| 호스트 비활성화 | ❌ (상태 값만 있음) | 비활성화/재활성화 함수 (공개 중 프로그램 처리 규칙 포함) |
| 콘텐츠 검토·공개 | ❌ | 목록·상세·공개·반려 |
| 프로그램 검토·공개 | ✅ | 그대로 |
| 이력 | ✅ 감사 기록 | 지원서별 이력 표시 |

모두 2단계 인증 관리자만, **서버(proxy·서버 액션) + DB(RLS·함수) 양쪽에서** 검사.

## 9. RLS·보장 사항 체크
| 요구 | 방법 |
|---|---|
| 중복 지원 방지 | 진행 중 지원서 1개 부분 고유 인덱스 |
| 중복 팔로우 방지 | 복합 기본키 |
| 미승인 호스트 비공개 | 공개 조회 정책: `status = approved`만 (지금과 동일) |
| 타인 신청서 열람 금지 | 지원서 조회: 본인 또는 관리자만, 연락처 열은 공개 권한 없음 |
| 심사 상태는 관리자만 | 상태 열 직접 수정 권한 없음, 관리자 함수로만 |
| 호스트는 자기 자료만 | 프로필·콘텐츠 수정 정책 `auth.uid()` 본인 |
| 탈퇴 | 지원서 연락처·본문 삭제, 팔로우 삭제, 콘텐츠는 비공개 처리 (+ pgTAP) |

## 10. 화면 목록 (MVP)
| 경로 | 새로/확장 | 기존 처리 |
|---|---|---|
| `/hosts` | 새로 (필터·검색·추천) | `/experts` → `/hosts`로 연결 |
| `/hosts/[slug]` | 확장 | `/hosts/[id]` → slug 주소로 연결 |
| `/become-a-host` | 새 대표 주소 (안내 + 지원 시작) | `/for-hosts` → 연결 |
| `/become-a-host/apply` | 지원서 (임시 저장·제출·상태) | `/host/apply` → 연결 |
| `/journal`, `/journal/[slug]` | 새로 | |
| `/me` | 확장 (팔로우·지원 상태·활동) | |
| `/me/contents` | 새로 (내 콘텐츠 작성·상태) | |
| `/admin/hosts/[applicationId]` | 새로 (지원서 상세·심사) | |
| `/admin/contents` | 새로 | |
| `/` | 재구성 | 갤러리·카드·디자인 재사용 |

## 11. 개발 순서와 각 단계 산출물
| 단계 | 내용 | DB 변경 | 검증 |
|---|---|---|---|
| 1 | 분류 체계 + `/hosts` 목록 | `categories.pillar`, `host_profiles.primary_pillar`·`is_featured` | pgTAP + E2E |
| 2 | 호스트 상세 개편 | `host_profiles.slug`·`occupation`·`philosophy`·`avatar_url` | E2E (옛 주소 연결 포함) |
| 3 | 지원서 분리 + 관리자 심사 | `host_applications` + 함수 + 기존 데이터 이전 | pgTAP(권한·중복·상태) + E2E(지원→수정 요청→재제출→승인) |
| 4 | 팔로우 + 마이페이지 | `follows` + 함수 | pgTAP + E2E |
| 5 | 콘텐츠 + 저널 + 관리자 검토 | `contents` + 함수 | pgTAP + E2E |
| 6 | 홈 재구성 | 없음 | E2E + 휴대폰 화면 |
| 7 | 관리자 보강 | 비활성화 함수 | pgTAP + E2E |

각 단계마다: 로컬 전체 테스트 → GitHub 저장 → 스테이징 검사(승인 필요) → 결과 보고.

## 12. 향후 기능 (이번에 만들지 않음)
시즌별 패키지, 참가자 포트폴리오, 호스트 등급·배지, 유료 브랜딩 지원(기획 패키지), 멤버십 전용 프로그램, 추천 알고리즘, 정산·분석 대시보드, 공동 진행자, 후기, 출석 체크

---

# 승인이 필요한 결정 사항
1. **MVP 범위**: 위 1~7단계 모두 진행할지, 일부만 할지
2. **분야 매핑**: 커피·요리 → Creators? 자세·운동 → Experts? 철학·인문·독서를 Knowledge로 다시 열지?
3. **화면 용어**: "프로그램" vs 지금의 "클래스" (DB 이름은 그대로 두고 화면 글자만)
4. **이미지**: ① Supabase Storage 업로드(추천, 인프라 추가·용량 제한) ② MVP는 https 이미지 주소 입력
5. **콘텐츠 본문 형식**: MVP는 일반 텍스트(문단)만 (추천) / 서식(굵게·제목 등)이 필요하면 안전한 마크다운 라이브러리 추가
6. **콘텐츠 작성 권한**: ① 처음엔 승인된 호스트 + 운영팀만 (추천: 심사 부담 작음) ② 모든 회원(Contributor) 바로 허용
7. **연락처 수집**: 지원서에 휴대폰 번호 필수? (본인·관리자만 열람, 탈퇴 시 삭제)
8. **주소 정리**: `/become-a-host`, `/hosts`를 대표 주소로 하고 옛 주소는 연결 (추천)
9. **홈 Membership 영역**: 실제 기능이 없으므로 "준비 중"으로만 표시 (추천)
10. **최근 본 콘텐츠**: 서버에 기록하지 않고 그 기기(브라우저)에만 저장 (추천: 개인정보 최소화)


---

# 결정 사항 (2026-11-09 창업자 확정)
| # | 항목 | 결정 |
|---|---|---|
| 1 | 범위 | 7단계 모두, **한 단계씩** 보고하며 진행 |
| 2 | 분야 매핑 | 추천대로: 사진·드로잉·악기·글쓰기·커피·요리 → Creators / 커리어·자세운동 → Experts / 철학·인문·독서 다시 열고 + 심리·경제사회·사고법 → Knowledge / 와인 잠금 유지 |
| 3 | 화면 용어 | **"프로그램"** (DB 이름 meetups는 그대로) |
| 4 | 사진 | Supabase Storage 업로드 (2단계에서 설정) |
| 5 | 콘텐츠 본문 | 일반 텍스트(문단)만 |
| 6 | 콘텐츠 작성 | 처음엔 승인된 호스트 + 운영팀만 |
| 7 | 지원서 연락처 | 휴대폰 번호 **필수** (본인·관리자만 열람, 탈퇴 시 삭제) |
| 8 | 주소 | `/hosts`, `/become-a-host` 대표, 옛 주소 자동 연결 |
| 9 | 홈 Membership | "준비 중" 표시만 |
| 10 | 최근 본 콘텐츠 | 기기(브라우저)에만 저장 |
