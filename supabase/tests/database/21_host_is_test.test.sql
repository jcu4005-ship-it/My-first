-- 자동 테스트 호스트 숨김 표시(is_test): 누구나 읽을 수 있지만, 회원·호스트·비로그인은 바꿀 수 없다
begin;
\ir _helpers.psql
select plan(4);

select pg_temp.create_member('ith@test.local', 'isTestHost') as h \gset
select pg_temp.published_session(:'h', 0, 6) as s \gset

select pg_temp.login_anon();
select is((select is_test from public.host_profiles where user_id = :'h'), false, '비로그인도 숨김 표시를 읽을 수 있다 (목록에서 걸러내기용)');
select throws_ok(format($$ update public.host_profiles set is_test = true where user_id = %L $$, :'h'), '42501', null, '비로그인은 숨김 표시를 바꿀 수 없다');
select pg_temp.logout();

select pg_temp.login_as(:'h');
select throws_ok(format($$ update public.host_profiles set is_test = true where user_id = %L $$, :'h'), '42501', null, '호스트 본인도 숨김 표시를 바꿀 수 없다');
select pg_temp.logout();

select is((select is_test from public.host_profiles where user_id = :'h'), false, '값은 그대로');

select * from finish();
rollback;
