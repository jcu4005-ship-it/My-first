-- 참가자 할인 쿠폰: 관리자만 발급, 10% 한도, 호스트 동의, 금액은 DB가 계산, 1인 1회·첫 참여·소진·기간
begin;
\ir _helpers.psql
select plan(29);

select pg_temp.create_member('ch@test.local', 'cpHost') as h \gset
select pg_temp.create_member('co@test.local', 'cpOther') as o \gset
select pg_temp.create_member('cp@test.local', 'cpPart') as p \gset
select pg_temp.create_member('cq@test.local', 'cpPart2') as q \gset
select pg_temp.create_member('ca@test.local', 'cpAdmin') as a \gset
select pg_temp.grant_role_direct(:'a', 'admin');
select set_config('t.s1', pg_temp.published_session(:'h', 40000, 10)::text, false);
select set_config('t.m', (select meetup_id::text from public.meetup_sessions where id = current_setting('t.s1')::uuid), false);
insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity)
values (current_setting('t.m')::uuid, now() + interval '9 days', now() + interval '9 days 2 hours', '성수동', '테스트 장소', '주소', 10);
select set_config('t.s2', (select id::text from public.meetup_sessions where meetup_id = current_setting('t.m')::uuid order by starts_at desc limit 1), false);
select pg_temp.published_session(:'o', 30000, 10) as os \gset

-- ---------- 발급 권한 ----------
select pg_temp.login_as(:'p');
select throws_ok($$ select public.admin_create_coupon('WELCOME10', '환영 쿠폰', 10::smallint, false, null, null) $$, '42501', null, '일반 회원은 쿠폰을 만들 수 없다');
select is((select count(*)::int from public.coupons), 0, '일반 회원은 쿠폰 목록을 볼 수 없다');
select pg_temp.logout();
select pg_temp.login_as(:'a', 'aal1');
select throws_ok($$ select public.admin_create_coupon('WELCOME10', '환영 쿠폰', 10::smallint, false, null, null) $$, '42501', null, '관리자도 2단계 인증 전에는 불가');
select pg_temp.logout();
select pg_temp.login_as(:'a', 'aal2');
select throws_ok($$ select public.admin_create_coupon('BIG20', '큰 할인', 20::smallint, false, null, null) $$, '22023', null, '10% 넘는 쿠폰은 만들 수 없다');
select throws_ok($$ insert into public.coupons (code, name, percent_off) values ('DIRECT', '직접', 5) $$, '42501', null, '표에 직접 넣을 수 없다');
select lives_ok($$ select set_config('t.c1', public.admin_create_coupon('welcome10', '환영 쿠폰', 10::smallint, false, null, null)::text, false) $$, '관리자(2단계 인증)는 10% 쿠폰 발급');
select lives_ok($$ select set_config('t.c2', public.admin_create_coupon('FIRST5', '첫 참여 쿠폰', 5::smallint, true, null, null)::text, false) $$, '첫 참여 전용 쿠폰 발급');
select lives_ok($$ select set_config('t.c3', public.admin_create_coupon('ONLY1', '한정 쿠폰', 10::smallint, false, 1, null)::text, false) $$, '사용 한도 1회 쿠폰 발급');
select throws_ok($$ select public.admin_create_coupon('WELCOME10', '중복', 5::smallint, false, null, null) $$, '22023', null, '같은 코드는 다시 만들 수 없다');
select pg_temp.logout();
select is((select code from public.coupons where id = current_setting('t.c1')::uuid), 'WELCOME10', '코드는 대문자로 저장');
select ok(exists(select 1 from public.audit_logs where action = 'coupon.create' and target_id = current_setting('t.c1')::uuid), '발급 감사 기록');
select throws_ok($$ update public.coupons set percent_off = 30 where code = 'WELCOME10' $$, '23514', null, 'DB 제약: 10% 초과 불가');

-- ---------- 호스트 동의 ----------
select pg_temp.login_as(:'p');
select throws_ok($$ select public.book_session(current_setting('t.s1')::uuid, 1, 'WELCOME10') $$, 'P0001', '이 프로그램은 쿠폰을 받지 않아요', '호스트 동의 전에는 쿠폰 사용 불가');
select pg_temp.logout();
select pg_temp.login_as(:'o');
select throws_ok($$ select public.host_set_coupon_consent(current_setting('t.m')::uuid, true) $$, 'P0002', null, '다른 호스트의 프로그램에는 동의할 수 없다');
select pg_temp.logout();
select pg_temp.login_as(:'h');
select throws_ok($$ update public.meetups set accept_coupons = true where id = current_setting('t.m')::uuid $$, '42501', null, '동의는 함수로만 (직접 수정 불가)');
select lives_ok($$ select public.host_set_coupon_consent(current_setting('t.m')::uuid, true) $$, '호스트 쿠폰 허용 동의');
select pg_temp.logout();
select ok((select accept_coupons and coupons_consented_at is not null from public.meetups where id = current_setting('t.m')::uuid), '동의 시각 기록');
select ok(exists(select 1 from public.audit_logs where action = 'meetup.coupon_consent' and target_id = current_setting('t.m')::uuid), '동의 감사 기록');

-- ---------- 미리보기·신청 ----------
select pg_temp.login_as(:'p');
select is((select array[gross, discount, total] from public.preview_coupon(current_setting('t.s1')::uuid, 2, 'welcome10')), array[80000, 8000, 72000], '미리보기: 2명 8만 원 → 10% 8천 원 할인');
select throws_ok($$ select public.book_session(current_setting('t.s1')::uuid, 1, 'NOPE') $$, 'P0001', '사용할 수 없는 쿠폰이에요', '없는 쿠폰');
select lives_ok($$ select set_config('t.b1', public.book_session(current_setting('t.s1')::uuid, 1, 'WELCOME10')::text, false) $$, '쿠폰으로 신청');
select is((select array[gross_amount, discount_amount, amount] from public.my_booking_payment(current_setting('t.b1')::uuid)), array[40000, 4000, 36000], '결제 금액 = 정가 − 할인 (DB 계산)');
select throws_ok($$ select public.book_session(current_setting('t.s2')::uuid, 1, 'WELCOME10') $$, 'P0001', '이미 사용한 쿠폰이에요', '같은 쿠폰은 한 사람당 한 번');
select pg_temp.logout();

-- 결제 확정 뒤 첫 참여 쿠폰은 못 씀
select pg_temp.login_service();
select public.confirm_payment(current_setting('t.b1')::uuid, 'mock', 'mock_cp1', 36000);
select pg_temp.logout();
select pg_temp.login_as(:'p');
select throws_ok($$ select public.book_session(current_setting('t.s2')::uuid, 1, 'FIRST5') $$, 'P0001', '첫 참여 때만 쓸 수 있는 쿠폰이에요', '첫 참여 전용 쿠폰은 확정 이력이 있으면 불가');
select lives_ok($$ select public.book_session(current_setting('t.s2')::uuid, 1, 'ONLY1') $$, '한정 쿠폰 1회 사용');
select pg_temp.logout();
select pg_temp.login_as(:'q');
select throws_ok($$ select public.book_session(current_setting('t.s1')::uuid, 1, 'ONLY1') $$, 'P0001', '쿠폰이 모두 소진되었어요', '사용 한도를 넘으면 불가');
select pg_temp.logout();

-- 비활성화
select pg_temp.login_as(:'a', 'aal2');
select lives_ok($$ select public.admin_set_coupon_active(current_setting('t.c1')::uuid, false) $$, '쿠폰 끄기');
select pg_temp.logout();
select pg_temp.login_as(:'q');
select throws_ok($$ select public.book_session(current_setting('t.s1')::uuid, 1, 'WELCOME10') $$, 'P0001', '사용할 수 없는 쿠폰이에요', '꺼진 쿠폰은 사용 불가');
select lives_ok($$ select public.book_session(current_setting('t.s1')::uuid, 1) $$, '쿠폰 없이 신청은 그대로 가능');
select pg_temp.logout();

select * from finish();
rollback;
