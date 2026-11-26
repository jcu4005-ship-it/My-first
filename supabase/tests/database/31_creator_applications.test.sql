-- 크리에이터 지원 접수: 로그인 없이 제출(검증·중복 방지), 관리자만 열람·상태 변경·메모, 연락처 가림, 향후 AI 결과물 표 보호
begin;
\ir _helpers.psql
select plan(28);

select pg_temp.create_member('cm@test.local', 'plainM') as m \gset
select pg_temp.create_member('ca@test.local', 'adminA') as a \gset
select pg_temp.grant_role_direct(:'a', 'admin');

-- 제출: 비로그인(anon)도 가능
select pg_temp.login_anon();
select lives_ok($$ select public.submit_creator_application('지원자 하나', 'art_culture', '골목 사진을 잘 찍어요', '동네 사진 모임을 2년 운영했어요', '내 경험을 나누고 싶어요', '010-0000-0011', 'https://example.com/me', null, true) $$, '비로그인도 지원서를 낼 수 있다');
select throws_ok($$ select public.submit_creator_application('지원자 하나', 'art_culture', '골목 사진을 잘 찍어요', '동네 사진 모임을 2년 운영했어요', '내 경험을 나누고 싶어요', '01000000011', null, null, true) $$, '22023', null, '같은 번호로 진행 중인 지원이 있으면 중복 접수 불가 (형식이 달라도)');
select throws_ok($$ select public.submit_creator_application('지원자 둘', 'knowledge', '짧', '동네 사진 모임을 2년 운영했어요', '내 경험을 나누고 싶어요', '010-0000-0022', null, null, true) $$, '22023', null, '답변이 너무 짧으면 거부');
select throws_ok($$ select public.submit_creator_application('지원자 둘', 'knowledge', '글을 잘 써요 정말로', '동네 사진 모임을 2년 운영했어요', '내 경험을 나누고 싶어요', '12345', null, null, true) $$, '22023', null, '휴대폰 번호 형식 검사');
select throws_ok($$ select public.submit_creator_application('지원자 둘', 'knowledge', '글을 잘 써요 정말로', '동네 사진 모임을 2년 운영했어요', '내 경험을 나누고 싶어요', '010-0000-0022', 'http://insecure.example', null, true) $$, '22023', null, '링크는 https만');
select throws_ok($$ select public.submit_creator_application('지원자 둘', 'knowledge', '글을 잘 써요 정말로', '동네 사진 모임을 2년 운영했어요', '내 경험을 나누고 싶어요', '010-0000-0022', null, null, false) $$, '22023', null, '동의 없이는 거부');
select throws_ok($$ select public.submit_creator_application('둘', 'knowledge', '글을 잘 써요 정말로', '동네 사진 모임을 2년 운영했어요', '내 경험을 나누고 싶어요', '010-0000-0022', null, null, true) $$, '22023', null, '이름은 2자 이상');
select lives_ok($$ select public.submit_creator_application('지원자 둘', 'knowledge', '글을 잘 써요 정말로', '출판사에서 일한 적이 있어요', '새로운 활동이 하고 싶어요', '010-0000-0022', null, '글쓰기 모임', true) $$, '선택 항목은 비워도, 적어도 된다');

-- 읽기 차단: 비로그인·일반 회원은 볼 수 없음
select throws_ok($$ select count(*) from public.creator_applications $$, '42501', null, '비로그인은 지원서 표를 읽을 수 없다');
select throws_ok($$ select count(*) from public.creator_application_notes $$, '42501', null, '비로그인은 메모 표를 읽을 수 없다');
select pg_temp.login_as(:'m');
select is((select count(*)::int from public.creator_applications), 0, '일반 회원에게는 지원서가 한 건도 보이지 않는다');
select is((select count(*)::int from public.creator_application_notes), 0, '일반 회원에게는 메모가 보이지 않는다');
select is((select count(*)::int from public.creator_application_outputs), 0, '일반 회원에게는 AI 결과물 표가 비어 보인다');
select throws_ok($$ select contact_phone from public.creator_applications $$, '42501', null, '연락처 열은 누구도 표에서 직접 읽을 수 없다');
select throws_ok($$ select public.admin_set_creator_application_status(gen_random_uuid(), 'reviewing') $$, '42501', null, '일반 회원은 상태를 바꿀 수 없다');
select throws_ok($$ select public.admin_add_creator_application_note(gen_random_uuid(), 'interview_memo', '메모') $$, '42501', null, '일반 회원은 메모를 쓸 수 없다');
select throws_ok($$ insert into public.creator_applications (name, field, strength, experience, motivation, contact_phone, consented_at) values ('직접', 'other', '12345', '12345', '12345', '01000000000', now()) $$, '42501', null, '표에 직접 넣는 것은 막혀 있다');

-- 관리자(2단계 인증 완료)
select pg_temp.login_as(:'a', 'aal2');
select is((select count(*)::int from public.creator_applications where name in ('지원자 하나', '지원자 둘')), 2, '관리자는 지원서 목록을 본다');
select is((select status::text from public.creator_applications where name = '지원자 하나'), 'new', '처음 상태는 신규 지원');
select lives_ok($$ select public.admin_set_creator_application_status((select id from public.creator_applications where name = '지원자 하나'), 'interview_scheduled') $$, '관리자는 상태를 바꿀 수 있다');
select is((select count(*)::int from public.audit_logs where action = 'creator_application.status' and target_id = (select id from public.creator_applications where name = '지원자 하나')), 1, '상태 변경은 감사 기록에 남는다');
select lives_ok($$ select public.admin_add_creator_application_note((select id from public.creator_applications where name = '지원자 하나'), 'interview_memo', '전화 인터뷰: 골목 사진 이야기를 할 때 눈이 반짝임') $$, '관리자는 인터뷰 메모를 쓸 수 있다');
select is((select count(*)::int from public.creator_application_notes where application_id = (select id from public.creator_applications where name = '지원자 하나')), 1, '메모가 지원자 단위로 저장된다');
select ok(public.admin_creator_application_contact((select id from public.creator_applications where name = '지원자 하나'), false, null) like '010-%', '연락처는 기본으로 가려 보인다');
select throws_ok($$ select public.admin_creator_application_contact((select id from public.creator_applications where name = '지원자 하나'), true, '짧') $$, '22023', null, '원문은 사유(5자 이상)를 적어야 열람');
select is(public.admin_creator_application_contact((select id from public.creator_applications where name = '지원자 하나'), true, '인터뷰 일정 전화'), '01000000011', '사유를 적으면 원문 열람 (숫자만 저장)');
select throws_ok($$ insert into public.creator_application_outputs (application_id, kind, content) values ((select id from public.creator_applications limit 1), 'intro_copy', '소개') $$, '42501', null, '관리자도 표에 직접 쓸 수 없다 (향후 전용 함수로만)');

-- 거절 후에는 같은 번호로 다시 지원할 수 있다
select public.admin_set_creator_application_status((select id from public.creator_applications where name = '지원자 둘'), 'rejected');
select pg_temp.login_anon();
select lives_ok($$ select public.submit_creator_application('지원자 둘 다시', 'knowledge', '글을 잘 써요 정말로', '출판사에서 일한 적이 있어요', '새로운 활동이 하고 싶어요', '01000000022', null, null, true) $$, '거절된 지원자는 다시 지원할 수 있다');

select * from finish();
rollback;
