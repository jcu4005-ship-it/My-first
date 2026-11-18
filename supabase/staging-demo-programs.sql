-- ============================================================================
-- 스테이징 전용: 대표가 참가자 입장에서 직접 신청해 보는 체험용 프로그램 (대표 요청 2026-11-18)
--  - 실제 크리에이터 이름을 쓰지 않음: 별도 "체험용 호스트" 계정(로그인 불가, .invalid 메일)
--  - 제목에 [체험용], 샘플이 아니라 실제로 신청 가능 (무료 1개 + 테스트 결제 유료 1개 — 실제 청구 없음)
--  - 다시 실행해도 됨: 프로그램은 한 번만 만들고, 다가오는 모집 일정이 없으면 새 일정만 추가
--  - 로컬 seed(sql_paths)에는 넣지 않음 — 스테이징 워크플로에서만 실행
-- ============================================================================
do $$
declare
  h uuid := 'b0000000-0000-4000-8000-0000000000d0';
  base timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  m uuid;
  r record;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (h, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-host@pending.invalid',
          extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}',
          jsonb_build_object('nickname', '체험용호스트', 'consents',
            jsonb_build_object('terms_version','pending','privacy_version','pending','age_14_plus',true)),
          now(), now())
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (h, 'host') on conflict (user_id, role) do nothing;
  insert into public.host_profiles (user_id, display_name, occupation, headline, expertise, primary_pillar, slug, status, is_sample, reviewed_at)
  values (h, '체험용 호스트', '신청 흐름 체험용 (스테이징)', '스테이징에서 신청을 직접 해 보기 위한 계정이에요', array['체험'], 'knowledge', 'demo-host', 'approved', false, now() - interval '1 year')
  on conflict (user_id) do nothing;

  for r in select * from (values
      ('[체험용] 무료 신청 체험 — 바로 확정돼요', 0, 4, 8, '무료 프로그램은 신청하면 바로 참가 확정돼요. 확정 후 상세 주소와 내 예약을 확인해 보세요.'),
      ('[체험용] 유료 신청 체험 — 테스트 결제', 10000, 5, 6, '유료 프로그램은 테스트 결제 화면을 거쳐 확정돼요. 실제 돈은 나가지 않아요. 취소하면 환불 기준에 따라 환불돼요.')
    ) as t(title, price, days, cap, summary)
  loop
    select id into m from public.meetups where host_id = h and title = r.title;
    if m is null then
      insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
                                  level, learning_outcomes, materials_note, target_audience, requirements, what_to_bring, agenda,
                                  refund_policy_text, status, is_sample, published_at)
      values (h, 'philosophy', 'general', r.title, r.summary,
              E'스테이징(시험용 사이트)에서 참가자 신청 흐름을 직접 체험해 보기 위한 프로그램이에요.\n\n실제로 열리지 않으며, 결제는 테스트 결제라 실제 청구가 없어요.',
              r.price, 2, 'all', E'신청부터 확정까지 흐름을 직접 확인해요.\n내 예약·알림·취소·환불을 확인해요.', '',
              '신청 흐름을 확인하고 싶은 분', '', '', '[{"time":"19:00","title":"체험"}]', '', 'published', false, now())
      returning id into m;
    end if;
    if not exists (select 1 from public.meetup_sessions where meetup_id = m and status = 'open' and starts_at > now() + interval '1 day') then
      insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity)
      values (m, base + make_interval(days => r.days, hours => 19), base + make_interval(days => r.days, hours => 21),
              '용산', '체험용 장소', '서울 용산구 (체험용 주소 — 실제로 열리지 않아요)', r.cap);
    end if;
  end loop;
end;
$$;
