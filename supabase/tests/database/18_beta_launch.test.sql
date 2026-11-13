-- 비공개 베타: 초대제 가입·유료 신청 막기·관리자만 설정 변경(감사 기록)
begin;
\ir _helpers.psql
select plan(19);

select pg_temp.create_member('bta@test.local', 'betaAdmin') as a \gset
select pg_temp.create_member('btu@test.local', 'betaUser') as u \gset
select pg_temp.create_member('bth@test.local', 'betaHost') as h \gset
select pg_temp.grant_role_direct(:'a', 'admin');

-- 공개 읽기: 누구나 현재 설정(초대제·유료 허용)을 볼 수 있다
select pg_temp.login_anon();
select is((select count(*)::int from public.app_settings), 1, '설정은 한 줄, 비로그인도 읽기 가능');
select throws_ok($$ select code from public.invite_codes $$, '42501', null, '비로그인은 초대 코드 표를 읽을 수 없다');
select pg_temp.logout();

-- 설정 변경은 관리자(2단계 인증)만, 사유 필수
select pg_temp.login_as(:'u');
select throws_ok($$ select public.admin_set_app_settings(true, false, '베타 시작합니다') $$, '42501', null, '일반 회원은 설정 변경 불가');
select is((select count(*)::int from public.invite_codes), 0, '일반 회원에게 초대 코드는 보이지 않는다');
select pg_temp.logout();
select pg_temp.login_as(:'a', 'aal1');
select throws_ok($$ select public.admin_set_app_settings(true, false, '베타 시작합니다') $$, '42501', null, '2단계 인증 전 관리자는 불가');
select pg_temp.logout();

select pg_temp.login_as(:'a', 'aal2');
select throws_ok($$ select public.admin_set_app_settings(true, false, '짧음') $$, '22023', '변경 사유를 5자 이상 입력하세요', '사유 5자 미만 거부');
select lives_ok($$ select public.admin_set_app_settings(true, false, '지인 대상 비공개 베타 시작') $$, '관리자: 초대제 켬·유료 막음');
select ok(exists(select 1 from public.audit_logs where action = 'settings.update' and reason = '지인 대상 비공개 베타 시작'), '설정 변경 감사 기록');
select throws_ok($$ select public.admin_create_invite_code('ab', '', 5, null) $$, '22023', '코드는 영문 대문자·숫자·하이픈 5~20자로 입력하세요', '잘못된 코드 형식 거부');
select lives_ok($$ select public.admin_create_invite_code('friends-01', '지인 1차', 1, null) $$, '초대 코드 발급 (소문자는 대문자로)');
select is((select code from public.invite_codes where code = 'FRIENDS-01'), 'FRIENDS-01', '관리자는 초대 코드를 볼 수 있다');
select pg_temp.logout();

-- 가입 화면용 확인 함수: 참/거짓만
select pg_temp.login_anon();
select ok(public.invite_code_valid(' friends-01 ') and not public.invite_code_valid('NOPE-0000'), '초대 코드 확인 (공백·대소문자 무시)');
select pg_temp.logout();

-- 초대제: 코드 없이 가입 불가
select throws_ok($$ select pg_temp.create_member('nocode@test.local', 'noCode') $$, '23514', 'invite_required', '초대 코드 없이 가입 거부');

-- 코드로 가입 → 사용 횟수 증가, 다 쓰면 다음 가입 거부
select lives_ok($$
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invited@test.local',
          '{"nickname":"invited1","invite_code":"friends-01","consents":{"terms_version":"v","privacy_version":"v","age_14_plus":true}}', now(), now()) $$,
  '초대 코드로 가입');
select is((select used_count from public.invite_codes where code = 'FRIENDS-01'), 1, '사용 횟수 1 증가');
select throws_ok($$
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invited2@test.local',
          '{"nickname":"invited2","invite_code":"FRIENDS-01","consents":{"terms_version":"v","privacy_version":"v","age_14_plus":true}}', now(), now()) $$,
  '23514', 'invite_required', '사용 횟수를 다 쓴 코드로는 가입 불가');

-- 유료 신청 막기 (무료는 그대로)
select pg_temp.published_session(:'h', 30000, 6) as paid \gset
select pg_temp.published_session(:'h', 0, 6) as free \gset
select pg_temp.login_as(:'u');
select throws_ok(format($$ select public.book_session(%L::uuid, 1) $$, :'paid'), '22023', '지금은 비공개 베타 기간이라 무료 프로그램만 신청할 수 있어요', '베타: 유료 프로그램 신청 거부');
select lives_ok(format($$ select public.book_session(%L::uuid, 1) $$, :'free'), '베타: 무료 프로그램은 신청 가능');
select pg_temp.logout();

-- 유료 허용으로 바꾸면 신청 가능 (테스트 결제 대기)
select pg_temp.login_as(:'a', 'aal2');
select public.admin_set_app_settings(false, true, '정식 오픈 결제 연결 완료');
select pg_temp.logout();
select pg_temp.login_as(:'u');
select lives_ok(format($$ select public.book_session(%L::uuid, 1) $$, :'paid'), '유료 허용 후에는 유료 신청 가능');
select pg_temp.logout();

select * from finish();
rollback;
