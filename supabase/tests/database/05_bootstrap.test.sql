-- 최초 관리자 지정 절차
begin;
\ir _helpers.psql
select plan(7);

select pg_temp.create_member('founder@test.local', 'founder') as f \gset
select pg_temp.create_member('unconfirmed@test.local', 'unconfirmed', false) as u \gset

-- 관리자가 없는 상태에서 시작 (로컬 DB에 이미 관리자가 있을 수 있으므로 트랜잭션 안에서만 비움)
delete from public.user_roles where role = 'admin';

select throws_ok($$ select private.bootstrap_first_admin('unconfirmed@test.local') $$, 'P0002', null,
  '이메일 인증을 마치지 않은 회원은 지정 불가');
select throws_ok($$ select private.bootstrap_first_admin('nobody@test.local') $$, 'P0002', null, '없는 회원은 지정 불가');
select is(private.bootstrap_first_admin('FOUNDER@test.local'), :'f'::uuid, '관리자가 없으면 인증된 회원을 최초 관리자로 지정');
select ok(exists(select 1 from public.user_roles where user_id = :'f' and role = 'admin'), '관리자 역할 부여됨');
select ok(exists(select 1 from public.audit_logs where actor_kind = 'bootstrap' and target_id = :'f'), '감사 기록(bootstrap) 생성');
select throws_ok($$ select private.bootstrap_first_admin('founder@test.local') $$, '42501', null,
  '관리자가 이미 있으면 다시 실행 불가');

select pg_temp.login_as(:'f', 'aal2');
select throws_ok($$ select private.bootstrap_first_admin('founder@test.local') $$, '42501', null,
  '로그인 회원 권한으로는 호출 자체가 불가');
select pg_temp.logout();

select * from finish();
rollback;
