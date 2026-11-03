-- 가입 트리거: 프로필·역할·동의 생성, 닉네임 정규화·중복·예약어, 필수 동의 검증
begin;
\ir _helpers.psql
select plan(16);

select pg_temp.create_member('a@test.local', 'Hong Gil') as a \gset

select is((select nickname from public.profiles where id = :'a'), 'Hong Gil', '프로필이 생성된다');
select ok(exists(select 1 from public.profile_private where user_id = :'a'), '비공개 정보 행이 생성된다');
select results_eq($$ select role::text from public.user_roles where user_id = '$$ || :'a' || $$' $$,
  $$ values ('participant') $$, '역할은 participant 하나만 부여된다');
select is((select count(*)::int from public.legal_consents where user_id = :'a'), 4, '동의 이력 4건(약관·개인정보·14세·마케팅)이 기록된다');

-- N4(DB): 가입 정보에 role: admin을 넣어도 무시
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'sneaky@test.local', now(),
        '{"nickname":"sneaky","role":"admin","roles":["admin","host"],
          "consents":{"terms_version":"v","privacy_version":"v","age_14_plus":true}}', now(), now());
select results_eq($$ select role::text from public.user_roles where user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('participant') $$, 'N4: 가입 정보의 role/roles 값은 무시되고 participant만 부여된다');

-- 닉네임 정규화: 앞뒤 공백 제거·연속 공백 정리
select pg_temp.create_member('b@test.local', '   민지   kim  ') as b \gset
select is((select nickname from public.profiles where id = :'b'), '민지 kim', '닉네임 앞뒤 공백 제거·연속 공백 1칸');

-- 중복: 대소문자·공백·전각 문자 차이는 같은 닉네임
select throws_ok($$ select pg_temp.create_member('c@test.local', 'honggil') $$, '23505', null,
  '중복: 대소문자·공백만 다른 닉네임(honggil)은 거부');
select throws_ok($$ select pg_temp.create_member('d@test.local', 'HONG  GIL') $$, '23505', null,
  '중복: 대문자·공백 수 차이(HONG  GIL)는 거부');
select throws_ok($$ select pg_temp.create_member('e@test.local', 'ＨＯＮＧ ＧＩＬ') $$, '23505', null,
  '중복: 전각 문자(ＨＯＮＧ ＧＩＬ)도 같은 닉네임으로 거부');

-- 예약어·허용되지 않는 문자·길이
select throws_ok($$ select pg_temp.create_member('f@test.local', '관리자') $$, '23514', null, '예약어 닉네임(관리자) 거부');
select throws_ok($$ select pg_temp.create_member('g@test.local', 'Ad Min') $$, '23514', null, '예약어(공백 섞인 Ad Min) 거부');
select throws_ok($$ select pg_temp.create_member('h@test.local', 'bad<script>') $$, '23514', null, '허용되지 않는 문자 거부');
select throws_ok($$ select pg_temp.create_member('i@test.local', 'a') $$, '23514', null, '1자 닉네임 거부');

-- 필수 동의 누락
select throws_ok($$
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'noconsent@test.local',
          '{"nickname":"noconsent","consents":{"terms_version":"v","privacy_version":"v","age_14_plus":false}}', now(), now()) $$,
  '23514', 'required_consents_missing', '만 14세 이상 확인이 없으면 가입 거부');
select throws_ok($$
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nonick@test.local',
          '{"consents":{"terms_version":"v","privacy_version":"v","age_14_plus":true}}', now(), now()) $$,
  '23514', 'nickname_required', '닉네임이 없으면 가입 거부');

-- 닉네임 사용 가능 확인 함수
select pg_temp.login_anon();
select ok(not public.nickname_available('HONG GIL') and public.nickname_available('새닉네임'),
  'nickname_available: 정규화 기준으로 판단');
select pg_temp.logout();

select * from finish();
rollback;
