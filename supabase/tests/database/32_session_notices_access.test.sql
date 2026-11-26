-- 호스트 공지 표(session_notices): 표는 아무도 직접 읽거나 쓸 수 없고, 호스트 함수로만 본인 프로그램의 공지를 본다
begin;
\ir _helpers.psql
select plan(6);

select pg_temp.create_member('sn_m@test.local', 'plainSn') as m \gset
select pg_temp.create_member('sn_h@test.local', 'hostSn') as h \gset
select pg_temp.grant_role_direct(:'h', 'host');

select pg_temp.login_anon();
select throws_ok($$ select count(*) from public.session_notices $$, '42501', null, 'session_notices: 비로그인은 표를 읽을 수 없다');
select throws_ok($$ select count(*) from public.host_session_notices(gen_random_uuid()) $$, '42501', null, 'session_notices: 비로그인은 공지 목록 함수도 실행할 수 없다');

select pg_temp.login_as(:'m');
select throws_ok($$ select count(*) from public.session_notices $$, '42501', null, 'session_notices: 로그인한 일반 회원도 표를 직접 읽을 수 없다');
select throws_ok($$ insert into public.session_notices (session_id, host_id, body, recipients) values (gen_random_uuid(), auth.uid(), '공지 내용입니다', 1) $$, '42501', null, 'session_notices: 표에 직접 넣을 수 없다 (호스트 공지 함수로만)');
select is((select count(*)::int from public.host_session_notices(gen_random_uuid())), 0, 'session_notices: 호스트가 아니면 공지 목록이 비어 있다');

select pg_temp.login_as(:'h');
select is((select count(*)::int from public.host_session_notices(gen_random_uuid())), 0, 'session_notices: 호스트도 내 프로그램이 아니면 공지가 보이지 않는다');

select * from finish();
rollback;
