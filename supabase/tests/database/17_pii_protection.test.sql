-- 개인정보 이중 보호: 가림 처리, 사유 있는 열람만 원문 + 감사 기록, 지원서 휴대폰 직접 읽기 차단, 보관 기간 정리
begin;
\ir _helpers.psql
select plan(17);

select pg_temp.create_member('piia@test.local', 'piiApplicant') as p \gset
select pg_temp.create_member('piio@test.local', 'piiOther') as o \gset
select pg_temp.create_member('piiad@test.local', 'piiAdmin') as a \gset
select pg_temp.grant_role_direct(:'a', 'admin');

-- 지원서 작성
select pg_temp.login_as(:'p');
select set_config('t.app', public.save_host_application('지원자', '010-1234-5678', 'knowledge', array['철학'], '한 줄 소개입니다', '', '', '', '', '', null, '', '', '', false)::text, false);
select throws_ok($$ select contact_phone from public.host_applications $$, '42501', null, '본인도 표에서 휴대폰 번호를 직접 읽을 수 없다');
select is(public.my_application_contact(), '010-1234-5678', '본인은 본인 함수로 휴대폰 번호를 볼 수 있다');
select pg_temp.logout();

select pg_temp.login_as(:'o');
select is(public.my_application_contact(), null, '다른 사람의 번호는 나오지 않는다');
select throws_ok(format($$ select public.admin_application_contact(%L, true, '궁금해서 봅니다') $$, current_setting('t.app')), '42501', null, '일반 회원은 열람 불가');
select pg_temp.logout();

-- 관리자: 2단계 인증 전 불가
select pg_temp.login_as(:'a', 'aal1');
select throws_ok(format($$ select public.admin_application_contact(%L, false, null) $$, current_setting('t.app')), '42501', null, '2단계 인증 전 관리자도 불가');
select throws_ok($$ select * from public.admin_list_members(null, 10, 0) $$, '42501', null, '2단계 인증 전 회원 목록 불가');
select pg_temp.logout();

select pg_temp.login_as(:'a', 'aal2');
select is(public.admin_application_contact(current_setting('t.app')::uuid, false, null), '010-****-5678', '기본은 가린 번호');
select throws_ok(format($$ select public.admin_application_contact(%L, true, '') $$, current_setting('t.app')), '22023', null, '원문 열람은 사유 필수');
select is(public.admin_application_contact(current_setting('t.app')::uuid, true, '심사 결과 안내 통화'), '010-1234-5678', '사유를 적으면 원문');
select is((select email from public.admin_list_members('piia@test.local', 10, 0) limit 1), 'p***@test.local', '회원 목록 이메일은 가림 (전체 이메일로 검색은 가능)');
select throws_ok(format($$ select public.admin_reveal_member_email(%L, '짧음') $$, :'p'), '22023', null, '이메일 원문도 사유 필수');
select is(public.admin_reveal_member_email(:'p', '본인 확인 요청 대응'), 'piia@test.local', '사유를 적으면 이메일 원문');
select pg_temp.logout();

select is((select count(*)::int from public.audit_logs where action = 'pii.reveal' and actor_id = :'a'), 2, '원문 열람 2번 모두 감사 기록');
select ok(exists(select 1 from public.audit_logs where action = 'pii.reveal' and target_id = current_setting('t.app')::uuid and reason = '심사 결과 안내 통화'), '열람 사유가 기록된다');
select throws_ok($$ delete from public.audit_logs where action = 'pii.reveal' $$, '42501', null, '열람 기록은 지울 수 없다');

-- 보관 기간 정리: 1년 지난 작성 중 지원서
-- 수정 시각 자동 갱신 트리거를 잠시 끄고 1년 전으로 되돌림 (테스트 준비)
set local session_replication_role = replica;
update public.host_applications set updated_at = now() - interval '13 months' where id = current_setting('t.app')::uuid;
set local session_replication_role = origin;
select pg_temp.login_as(:'a', 'aal2');
select is(public.admin_purge_stale_pii(), 1, '1년 지난 미제출 지원서 1건 정리');
select pg_temp.logout();
select is((select contact_phone from public.host_applications where id = current_setting('t.app')::uuid), '', '정리 후 휴대폰 번호가 지워진다');

select * from finish();
rollback;
