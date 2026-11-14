-- ============================================================================
-- 실제 첫 호스트 3명 (대표 요청 2026-11-14): 이름·하는 일·분야만.
-- 로컬·CI(db reset)와 스테이징 배포에서 실행. 소개·사진·프로그램은 본인이 직접 채울 때까지 비워 둠.
--  - 샘플이 아니므로 is_sample = false ("샘플" 표시 없음), 화면에는 "소개 준비 중"으로 보임
--  - 임시 계정: 로그인 불가(임의 비밀번호, .invalid 메일). 본인 가입 후 실제 계정으로 옮기는 작업은 따로 진행
--  - 다시 실행해도 됨: 이미 있으면 아무것도 바꾸지 않음 (본인이 채운 내용을 덮어쓰지 않음)
-- 예시 프로그램(대표 요청 2026-11-14): 3명의 분야에 맞춰 임의로 만든 예시. 실제 이름이 붙으므로
--  반드시 is_sample = true ("샘플" 표시, 신청 불가). 본인이 실제 프로그램을 올리면 지우면 됨.
--  다시 실행하면 이 3명의 예시 프로그램만 지우고 다시 넣음 (샘플은 신청 기록이 생길 수 없음)
-- ============================================================================
do $$
declare
  p1 uuid := 'b0000000-0000-4000-8000-000000000001';
  p2 uuid := 'b0000000-0000-4000-8000-000000000002';
  p3 uuid := 'b0000000-0000-4000-8000-000000000003';
  base timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  m uuid;
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

  -- 예시 프로그램 (샘플) ------------------------------------------------------------
  delete from public.meetup_sessions where meetup_id in (select id from public.meetups where is_sample and host_id in (p1, p2, p3));
  delete from public.meetups where is_sample and host_id in (p1, p2, p3);

  -- 홍지완 · 스피치
  insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
    level, learning_outcomes, materials_note, target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (p1, 'career', 'class', '떨지 않고 3분 말하기 — 자기소개 스피치 클래스',
    '목소리·속도·시선 세 가지만 바꿔도 달라져요. 내 자기소개를 직접 다듬고 말해 봐요.',
    E'(예시 프로그램입니다. 호스트가 실제 내용으로 바꿀 예정이에요.)\n\n사람들 앞에서 말할 때 떨리는 분을 위한 소규모 스피치 클래스입니다.\n\n처음에는 호흡과 발성, 말의 속도를 익히고, 각자 3분 자기소개 원고를 다듬습니다. 마지막에는 둥글게 앉아 한 사람씩 말해 보고 서로 좋았던 점을 나눕니다.',
    40000, 1, 'beginner',
    E'떨림을 줄이는 호흡법을 익혀요.\n3분 자기소개를 내 말투로 완성해요.',
    '원고 작성지 제공',
    '발표·면접·모임 자기소개가 부담스러운 분', '', '필기도구',
    '[{"time":"19:30","title":"호흡·발성·속도"},{"time":"20:10","title":"자기소개 원고 다듬기"},{"time":"20:50","title":"한 사람씩 말해 보기"}]',
    '예시 프로그램이라 신청할 수 없어요. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity) values
    (m, base + interval '4 days 19 hours 30 minutes', base + interval '4 days 21 hours 30 minutes', '성수', '예시 장소', '서울 성동구 (샘플 주소)', 6);

  -- 양승효 · 사진
  insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
    level, learning_outcomes, materials_note, target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (p2, 'photo', 'outdoor', '휴대폰으로 찍는 골목 사진 — 빛과 구도 산책',
    '비싼 카메라 없이 휴대폰 하나로 빛과 구도를 보는 법을 배우며 골목을 걸어요.',
    E'(예시 프로그램입니다. 호스트가 실제 내용으로 바꿀 예정이에요.)\n\n휴대폰 카메라로 사진을 더 잘 찍고 싶은 분을 위한 산책형 클래스입니다.\n\n빛이 들어오는 방향과 간단한 구도 규칙을 먼저 익히고, 골목을 함께 걸으며 직접 찍어 봅니다. 마지막에는 각자 고른 한 장을 함께 보며 이야기를 나눕니다.',
    35000, 2, 'beginner',
    E'빛의 방향을 보고 찍는 위치를 고를 수 있어요.\n세 가지 구도 규칙으로 사진을 정리할 수 있어요.',
    '없음 (휴대폰만 있으면 돼요)',
    '휴대폰 사진을 한 단계 나아가게 하고 싶은 분', '1시간 30분 정도 걸을 수 있는 체력', '충전된 휴대폰, 편한 신발',
    '[{"time":"15:00","title":"빛과 구도 기초"},{"time":"15:30","title":"골목 산책하며 찍기"},{"time":"16:40","title":"한 장씩 함께 보기"}]',
    '예시 프로그램이라 신청할 수 없어요. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity) values
    (m, base + interval '6 days 15 hours', base + interval '6 days 17 hours', '서촌', '예시 장소', '서울 종로구 (샘플 주소)', 6);

  -- 주찬욱 · 보컬
  insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
    level, learning_outcomes, materials_note, target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (p3, 'music', 'class', '내 목소리 찾기 — 처음 배우는 보컬 원데이',
    '호흡과 발성의 기본을 익히고, 좋아하는 노래 한 소절을 편하게 불러 봐요.',
    E'(예시 프로그램입니다. 호스트가 실제 내용으로 바꿀 예정이에요.)\n\n노래를 배워 본 적 없는 분을 위한 보컬 입문 클래스입니다.\n\n복식 호흡과 편하게 소리 내는 법을 익히고, 각자 좋아하는 노래의 한 소절을 골라 함께 연습합니다. 서로의 목소리를 듣고 응원하는 작은 자리예요.',
    45000, 1, 'beginner',
    E'목이 아프지 않게 소리 내는 법을 익혀요.\n좋아하는 노래 한 소절을 편하게 부를 수 있어요.',
    '연습실 대여 포함',
    '노래를 배워 보고 싶었지만 시작하지 못한 분', '', '물, 부르고 싶은 노래 한 곡',
    '[{"time":"14:00","title":"호흡·발성 기초"},{"time":"14:40","title":"한 소절 연습"},{"time":"15:30","title":"돌아가며 불러 보기"}]',
    '예시 프로그램이라 신청할 수 없어요. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity) values
    (m, base + interval '9 days 14 hours', base + interval '9 days 16 hours', '합정', '예시 장소', '서울 마포구 (샘플 주소)', 4);

end;
$$;
