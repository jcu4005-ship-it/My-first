-- ============================================================================
-- 실제 첫 호스트 3명 (대표 요청 2026-11-14): 이름·하는 일·분야만.
-- 로컬·CI(db reset)와 스테이징 배포에서 실행. 소개·사진·프로그램은 본인이 직접 채울 때까지 비워 둠.
--  - 샘플이 아니므로 is_sample = false ("샘플" 표시 없음), 화면에는 "소개 준비 중"으로 보임
--  - 임시 계정: 로그인 불가(임의 비밀번호, .invalid 메일). 본인 가입 후 실제 계정으로 옮기는 작업은 따로 진행
--  - 다시 실행해도 됨: 이미 있으면 아무것도 바꾸지 않음 (본인이 채운 내용을 덮어쓰지 않음)
-- ============================================================================
do $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
         extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}',
         jsonb_build_object('nickname', nick, 'consents',
           jsonb_build_object('terms_version','pending','privacy_version','pending','age_14_plus',true)),
         now(), now()
  from (values
    ('b0000000-0000-4000-8000-000000000001'::uuid, 'host-speech@pending.invalid', '홍지완'),
    ('b0000000-0000-4000-8000-000000000002'::uuid, 'host-photo@pending.invalid',  '양승효'),
    ('b0000000-0000-4000-8000-000000000003'::uuid, 'host-vocal@pending.invalid',  '주찬욱')
  ) as t(id, email, nick)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values
    ('b0000000-0000-4000-8000-000000000001', 'host'),
    ('b0000000-0000-4000-8000-000000000002', 'host'),
    ('b0000000-0000-4000-8000-000000000003', 'host')
    on conflict (user_id, role) do nothing;

  insert into public.host_profiles (user_id, display_name, occupation, expertise, primary_pillar, slug, status, is_sample)
  values
    ('b0000000-0000-4000-8000-000000000001', '홍지완', '스피치 강사',   array['스피치'], 'experts',  'hong-jiwan',    'approved', false),
    ('b0000000-0000-4000-8000-000000000002', '양승효', '사진작가',      array['사진'],   'creators', 'yang-seunghyo', 'approved', false),
    ('b0000000-0000-4000-8000-000000000003', '주찬욱', '보컬 트레이너', array['보컬'],   'creators', 'joo-chanwook',  'approved', false)
  on conflict (user_id) do nothing;

end;
$$;
