-- 호스트 지원서: 열람 범위, 상태 흐름(수정 요청·재제출·반려 후 재지원), 승인 시 공개 프로필, 탈퇴 정리
begin;
\ir _helpers.psql
select plan(20);

select pg_temp.create_member('ap@test.local', 'applicantA') as a \gset
select pg_temp.create_member('ao@test.local', 'otherO') as o \gset
select pg_temp.create_member('ad@test.local', 'adminD') as d \gset
select pg_temp.grant_role_direct(:'d', 'admin');

-- 지원자 A: 저장 → 제출
select pg_temp.login_as(:'a');
select lives_ok($$ select public.save_host_application('지원자 에이', '01012345678', 'knowledge', array['철학'], '철학으로 생각 정리', '자기소개를 스무 자 이상 적는 테스트 문장입니다.', '대학 철학과 강사 8년, 기업 워크숍 4년 진행', '', 'https://example.com/a', '', null, '질문 사다리로 고민을 정리하는 두 시간 워크숍 기획안입니다.', '생각 지도를 완성해 가요', '원데이, 10명', true) $$, '임시 저장');
select throws_ok($$ select public.save_host_application('x', 'not-a-phone', null, null, '', '', '', '', '', '', null, '', '', '', false) $$, '23514', null, '휴대폰 번호 형식 검사');
select lives_ok($$ select public.submit_host_application() $$, '제출');
select is((select count(*)::int from public.host_applications where applicant_id = auth.uid()), 1, '진행 중 지원서는 1개');
select throws_ok($$ select public.submit_host_application() $$, 'P0002', null, '이미 제출했으면 다시 제출할 수 없다');
select pg_temp.logout();
select set_config('t.app', (select id::text from public.host_applications where applicant_id = :'a'), false);

-- 다른 회원·비로그인은 볼 수 없음
select pg_temp.login_as(:'o');
select is((select count(*)::int from public.host_applications where applicant_id = :'a'), 0, '다른 회원은 남의 지원서를 볼 수 없다');
select pg_temp.logout();
select pg_temp.login_anon();
select throws_ok($$ select contact_phone from public.host_applications $$, '42501', null, '비로그인은 지원서를 볼 수 없다');
select pg_temp.logout();

-- 예전 신청 경로는 닫힘
select pg_temp.login_as(:'o');
select throws_ok($$ select public.apply_host('x', 'x', 'x', null, null, 'x', '', '', '') $$, '42501', null, '예전 신청 함수는 실행할 수 없다');
select pg_temp.logout();

-- 관리자: 심사 시작 → 수정 요청
select pg_temp.login_as(:'d', 'aal2');
select is(public.admin_review_host_application(current_setting('t.app')::uuid, 'start_review', null), 'reviewing'::public.application_status, '심사 시작');
select throws_ok($$ select public.admin_review_host_application(current_setting('t.app')::uuid, 'request_revision', '') $$, '22023', null, '수정 요청은 메모 필수');
select is(public.admin_review_host_application(current_setting('t.app')::uuid, 'request_revision', '기획안에 대상과 준비물을 추가해 주세요'), 'revision_requested'::public.application_status, '수정 요청');
select ok(exists(select 1 from public.host_applications where id = current_setting('t.app')::uuid), '관리자는 지원서를 볼 수 있다');
select pg_temp.logout();
select ok(exists(select 1 from public.notifications where user_id = :'a' and kind = 'host.revision_requested'), '수정 요청 알림');

-- 지원자: 고쳐서 다시 제출
select pg_temp.login_as(:'a');
select lives_ok($$ select public.save_host_application('지원자 에이', '01012345678', 'knowledge', array['철학'], '철학으로 생각 정리', '자기소개를 스무 자 이상 적는 테스트 문장입니다.', '대학 철학과 강사 8년, 기업 워크숍 4년 진행', '', 'https://example.com/a', '', null, '대상: 직장인 / 준비물: 필기구. 질문 사다리로 고민을 정리하는 워크숍.', '생각 지도를 완성해 가요', '원데이, 10명', true) $$, '수정 요청 후 고칠 수 있다');
select lives_ok($$ select public.submit_host_application() $$, '다시 제출');
select pg_temp.logout();

-- 승인 → 공개 프로필·역할·주소
select pg_temp.login_as(:'d', 'aal2');
select lives_ok($$ select public.admin_review_host_application(current_setting('t.app')::uuid, 'approve', null) $$, '승인');
select pg_temp.logout();
select ok((select status = 'approved' and primary_pillar = 'knowledge' and slug is not null from public.host_profiles where user_id = :'a'), '승인되면 공개 프로필(분류·주소 포함)이 생긴다');
select ok(exists(select 1 from public.user_roles where user_id = :'a' and role = 'host'), '호스트 역할 부여');

-- 반려 후 재지원 가능 (회원 O)
select pg_temp.login_as(:'o');
select public.save_host_application('지원자 오', '01098765432', 'creators', array['사진'], '사진을 가르칩니다', '자기소개를 스무 자 이상 적는 테스트 문장입니다.', '사진 스튜디오 포토그래퍼 10년 경력입니다', '', '', '', null, '스마트폰 인물 사진 두 시간 실습 프로그램 기획안입니다.', '인생 사진 한 장을 완성해 가요', '원데이', true);
select public.submit_host_application();
select pg_temp.logout();
select pg_temp.login_as(:'d', 'aal2');
select public.admin_review_host_application((select id from public.host_applications where applicant_id = :'o'), 'reject', '포트폴리오를 보완해 주세요');
select pg_temp.logout();
select pg_temp.login_as(:'o');
select lives_ok($$ select public.save_host_application('지원자 오', '01098765432', 'creators', array['사진'], '', '', '', '', '', '', null, '', '', '', false) $$, '반려 후 새 지원서를 쓸 수 있다');
select pg_temp.logout();

-- 탈퇴: 지원서 개인정보 삭제
select pg_temp.login_as(:'o');
select public.withdraw_my_account();
select pg_temp.logout();
select ok((select bool_and(contact_phone = '' and career = '' and program_proposal = '') from public.host_applications where applicant_id = :'o'), '탈퇴하면 지원서 개인정보가 지워진다');

select * from finish();
rollback;
