-- 권한 상승 차단 (N1~N3, N5, N6, N13, N14) + 관리자 정상 동작
begin;
\ir _helpers.psql
select plan(22);

select pg_temp.create_member('p@test.local', 'participantA') as p \gset
select pg_temp.create_member('h@test.local', 'hostH') as h \gset
select pg_temp.create_member('adm@test.local', 'adminZ') as adm \gset
select pg_temp.grant_role_direct(:'h', 'host');
select pg_temp.grant_role_direct(:'adm', 'admin');

-- ---------- 참가자 A ----------
select pg_temp.login_as(:'p');
select throws_ok(format($$ insert into public.user_roles (user_id, role) values (%L, 'admin') $$, :'p'),
  '42501', null, 'N1: 참가자가 자기 admin 역할 추가 → 거부');
select throws_ok(format($$ insert into public.user_roles (user_id, role) values (%L, 'host') $$, :'p'),
  '42501', null, 'N1: 참가자가 자기 host 역할 추가 → 거부');
select throws_ok(format($$ update public.user_roles set role = 'admin' where user_id = %L $$, :'p'),
  '42501', null, 'N2: 참가자가 자기 역할 행 수정 → 거부');
select throws_ok(format($$ delete from public.user_roles where user_id = %L $$, :'h'),
  '42501', null, 'N2: 참가자가 남의 역할 삭제 → 거부');
select throws_ok(format($$ select public.admin_set_user_role(%L, 'admin', true, '스스로 관리자') $$, :'p'),
  '42501', null, 'N3: 참가자가 역할 변경 함수 직접 호출 → 거부');
select throws_ok(format($$ select public.admin_set_member_status(%L, 'suspended', '남을 정지') $$, :'h'),
  '42501', null, 'N3: 참가자가 회원 상태 변경 함수 호출 → 거부');
select throws_ok($$ select * from public.admin_list_members() $$, '42501', null, 'N3: 참가자가 회원 목록 함수 호출 → 거부');
select throws_ok($$ select private.bootstrap_first_admin('p@test.local') $$, '42501', null,
  'N3: 참가자가 최초 관리자 지정 함수 호출 → 거부');
select throws_ok(format($$ update public.profiles set status = 'active' where id = %L $$, :'p'),
  '42501', null, 'N5: 참가자가 자기 회원 상태 수정 → 거부(열 권한 없음)');
select throws_ok(format($$ update public.profile_private set adult_verified_at = now() where user_id = %L $$, :'p'),
  '42501', null, 'N6: 참가자가 성인 확인 시각 수정 → 거부');
select results_eq($$ select role::text from public.user_roles $$, $$ values ('participant') $$,
  '참가자는 자기 역할 행만 보인다');
select pg_temp.logout();
select results_eq(format($$ select role::text from public.user_roles where user_id = %L $$, :'p'),
  $$ values ('participant') $$, '공격 시도 후에도 참가자 역할은 participant 그대로');

-- ---------- 호스트도 관리자 기능 불가 ----------
select pg_temp.login_as(:'h', 'aal2');
select throws_ok(format($$ select public.admin_set_user_role(%L, 'admin', true, '호스트의 권한 상승') $$, :'h'),
  '42501', null, '호스트(aal2)도 역할 변경 불가');
select pg_temp.logout();

-- ---------- N13: 관리자이지만 2단계 인증 전(aal1) ----------
select pg_temp.login_as(:'adm', 'aal1');
select throws_ok(format($$ select public.admin_set_user_role(%L, 'host', true, '호스트 승인 테스트') $$, :'p'),
  '42501', null, 'N13: 2단계 인증 전 관리자는 역할 변경 불가');
select throws_ok($$ select * from public.admin_list_members() $$, '42501', null, 'N13: 2단계 인증 전 관리자는 회원 목록 불가');
select is_empty($$ select 1 from public.audit_logs $$, 'N13: 2단계 인증 전 관리자는 감사 기록 조회 불가');
select pg_temp.logout();

-- ---------- 관리자 aal2: 정상 동작 + 감사 기록 ----------
select pg_temp.login_as(:'adm', 'aal2');
select lives_ok(format($$ select public.admin_set_user_role(%L, 'host', true, '호스트 승인 테스트') $$, :'p'),
  '관리자(aal2)는 역할 부여 가능');
select throws_ok(format($$ select public.admin_set_user_role(%L, 'host', true, '짧') $$, :'p'),
  '22023', null, '사유 5자 미만이면 거부');
-- N14
select throws_ok(format($$ select public.admin_set_user_role(%L, 'admin', false, '자기 권한 회수 시도') $$, :'adm'),
  '42501', null, 'N14: 자기 자신의 관리자 권한 회수 불가');
select pg_temp.logout();

-- N14: 마지막 관리자 회수 불가 (관리자 2명 → 다른 관리자가 회수 시도 시 1명 남으므로 허용, 0명 되면 거부)
select pg_temp.create_member('adm2@test.local', 'adminY') as adm2 \gset
select pg_temp.grant_role_direct(:'adm2', 'admin');
select pg_temp.login_as(:'adm2', 'aal2');
select lives_ok(format($$ select public.admin_set_user_role(%L, 'admin', false, '관리자 1명 회수') $$, :'adm'),
  '관리자가 2명일 때 다른 관리자 회수는 가능');
select pg_temp.logout();

select results_eq(
  format($$ select action, actor_id::text, target_id::text from public.audit_logs where action like 'role.%%' and target_id in (%L, %L) order by id $$, :'p', :'adm'),
  format($$ values ('role.grant', %L, %L), ('role.revoke', %L, %L) $$, :'adm', :'p', :'adm2', :'adm'),
  '역할 부여·회수가 행위자·대상과 함께 감사 기록에 남는다'
);
select results_eq(format($$ select role::text from public.user_roles where user_id = %L order by role $$, :'p'),
  $$ values ('host'), ('participant') $$, '관리자 부여 결과 반영');

select * from finish();
rollback;
