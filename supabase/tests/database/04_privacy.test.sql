-- 개인정보·기록 보호 (N7~N12, N15~N17)
begin;
\ir _helpers.psql
select plan(22);

select pg_temp.create_member('a@test.local', 'memberA') as a \gset
select pg_temp.create_member('b@test.local', 'memberB') as b \gset
select pg_temp.create_member('h@test.local', 'hostH') as h \gset
select pg_temp.create_member('adm@test.local', 'adminZ') as adm \gset
select pg_temp.grant_role_direct(:'h', 'host');
select pg_temp.grant_role_direct(:'adm', 'admin');
update public.profile_private set phone = '01012345678', birth_year = 1995 where user_id = :'b';
insert into public.audit_logs (actor_kind, action) values ('system', 'test.seed');

-- ---------- 회원 A ----------
select pg_temp.login_as(:'a');
select is_empty(format($$ select 1 from public.profile_private where user_id = %L $$, :'b'), 'N7: A는 B의 비공개 정보를 볼 수 없다');
select results_eq($$ select user_id::text from public.profile_private $$, format($$ values (%L) $$, :'a'),
  'A에게 보이는 비공개 정보는 자기 것뿐');
select lives_ok(format($$ update public.profile_private set phone = '01099999999' where user_id = %L $$, :'b'),
  'N8: A가 B 정보 수정 시도 (오류 없이 0건 처리)');
select is_empty(format($$ select 1 from public.legal_consents where user_id = %L $$, :'b'), 'N11: A는 B의 동의 이력을 볼 수 없다');
select throws_ok(format($$ insert into public.legal_consents (user_id, consent_type, document_version, agreed) values (%L, 'marketing', 'v', true) $$, :'b'),
  '42501', null, 'N11: A는 동의 이력을 직접 추가할 수 없다');
select is_empty($$ select 1 from public.audit_logs $$, 'N12: A는 감사 기록을 볼 수 없다');
select throws_ok($$ insert into public.audit_logs (actor_kind, action) values ('admin', 'fake') $$, '42501', null,
  'N12: A는 감사 기록을 추가할 수 없다');
select is_empty(format($$ select 1 from public.user_roles where user_id = %L $$, :'b'), 'A는 B의 역할을 볼 수 없다');
select throws_ok($$ select nickname_key from public.profiles $$, '42501', null, '프로필 내부 열(nickname_key)은 조회 불가');
select lives_ok(format($$ update public.profile_private set phone = '01011112222' where user_id = %L $$, :'a'),
  '본인 연락처 수정은 가능');
select lives_ok(format($$ update public.profiles set bio = '안녕하세요' where id = %L $$, :'a'), '본인 소개 수정은 가능');
select pg_temp.logout();
select is((select phone from public.profile_private where user_id = :'b'), '01012345678', 'N8: B의 연락처는 바뀌지 않았다');
select is((select phone from public.profile_private where user_id = :'a'), '01011112222', '본인 수정은 반영됨');

-- ---------- 호스트 H ----------
select pg_temp.login_as(:'h', 'aal2');
select is_empty(format($$ select 1 from public.profile_private where user_id in (%L, %L) $$, :'a', :'b'),
  'N9: 호스트는 참가자의 비공개 정보(연락처)를 볼 수 없다');
select pg_temp.logout();

-- ---------- 관리자도 비공개 정보 직접 조회 불가 ----------
select pg_temp.login_as(:'adm', 'aal2');
select is_empty(format($$ select 1 from public.profile_private where user_id = %L $$, :'b'),
  '관리자도 비공개 정보 표를 직접 조회할 수 없다 (감사 기록되는 별도 기능으로만)');
-- N15
select throws_ok($$ delete from public.audit_logs $$, '42501', null, 'N15: 관리자도 감사 기록 삭제 불가');
select pg_temp.logout();
-- DB 소유자 권한에서도 트리거가 수정·삭제를 막음
select throws_ok($$ update public.audit_logs set action = 'tampered' $$, '42501', null, 'N15: DB 소유자로도 감사 기록 수정 불가(트리거)');
select throws_ok($$ delete from public.legal_consents $$, '42501', null, 'N15: DB 소유자로도 동의 이력 삭제 불가(트리거)');

-- ---------- N10: 비로그인 ----------
select pg_temp.login_anon();
select throws_ok($$ select * from public.profile_private $$, '42501', null, 'N10: 비로그인은 비공개 정보 표 접근 불가');
select throws_ok($$ select * from public.user_roles $$, '42501', null, 'N10: 비로그인은 역할 표 접근 불가');
select pg_temp.logout();

-- ---------- N17: 정지 회원 ----------
update public.profiles set status = 'suspended' where id = :'a';
select pg_temp.login_as(:'a');
select lives_ok(format($$ update public.profiles set bio = '정지 중 수정' where id = %L $$, :'a'), 'N17: 정지 회원 수정 시도');
select pg_temp.logout();
select is((select bio from public.profiles where id = :'a'), '안녕하세요', 'N17: 정지 회원의 수정은 반영되지 않는다');

select * from finish();
rollback;
