-- 테스트 결제·환불, 결제 대기 만료, 호스트 일정 취소, 알림, 회원 탈퇴
begin;
\ir _helpers.psql
select plan(47);

select pg_temp.create_member('host@test.local', 'payHost') as h \gset
select pg_temp.create_member('p@test.local', 'payP') as p \gset
select pg_temp.create_member('q@test.local', 'payQ') as q \gset
select set_config('t.sid', pg_temp.published_session(:'h', 20000, 3)::text, false);

-- ---------- 유료 신청 → 결제 대기 ----------
select pg_temp.login_as(:'p');
select lives_ok($$ select set_config('t.bid', public.book_session(current_setting('t.sid')::uuid, 2)::text, false) $$, '유료 모임 신청');
select is((select booking_status::text from public.my_booking_payment(current_setting('t.bid')::uuid)), 'pending_payment', '결제 대기 상태');
select is((select amount from public.my_booking_payment(current_setting('t.bid')::uuid)), 40000, '결제 금액 = 참가비 x 인원');
select is(public.book_session(current_setting('t.sid')::uuid, 2), current_setting('t.bid')::uuid, '결제 대기 중 다시 신청하면 같은 신청으로 이어짐');
select throws_ok($$ select public.confirm_payment(current_setting('t.bid')::uuid, 'mock', 'fake-key', 40000) $$, '42501', null, '참가자는 결제 확정을 직접 호출할 수 없다');
select throws_ok($$ select public.refund_booking(current_setting('t.bid')::uuid, auth.uid(), 'cancelled_by_user', 'x') $$, '42501', null, '참가자는 환불 기록을 직접 호출할 수 없다');
select throws_ok($$ insert into public.payments (booking_id, order_id, amount) values (current_setting('t.bid')::uuid, 'X', 1) $$, '42501', null, '결제 표에 직접 추가 불가');
select throws_ok($$ update public.payments set status = 'paid' $$, '42501', null, '결제 상태를 직접 바꿀 수 없다');
select is((select count(*)::int from public.my_bookings() where address_detail is not null), 0, '결제 전에는 상세 주소가 보이지 않는다');
select pg_temp.logout();
select is((select reserved_count::int from public.meetup_sessions where id = current_setting('t.sid')::uuid), 2, '결제 대기 중에도 자리를 잡아 둔다');

-- 다른 사람은 남은 1자리만
select pg_temp.login_as(:'q');
select throws_ok($$ select public.book_session(current_setting('t.sid')::uuid, 2) $$, 'P0001', null, '결제 대기 자리도 정원에 포함');
select pg_temp.logout();

-- ---------- 결제 확정 (서버) ----------
select pg_temp.login_service();
select throws_ok($$ select public.confirm_payment(current_setting('t.bid')::uuid, 'mock', 'mock_1', 100) $$, 'P0001', null, '금액이 다르면 확정 거부');
select lives_ok($$ select public.confirm_payment(current_setting('t.bid')::uuid, 'mock', 'mock_1', 40000) $$, '서버가 결제 확정');
select lives_ok($$ select public.confirm_payment(current_setting('t.bid')::uuid, 'mock', 'mock_1', 40000) $$, '같은 결제 중복 확정은 무시 (멱등)');
select pg_temp.logout();
select is((select status::text from public.bookings where id = current_setting('t.bid')::uuid), 'confirmed', '결제 후 확정');
select is((select status::text from public.payments where booking_id = current_setting('t.bid')::uuid), 'paid', '결제 완료 기록');
select ok(exists(select 1 from public.notifications where user_id = :'p' and kind = 'booking.confirmed'), '참가자에게 확정 알림');
select ok(exists(select 1 from public.notifications where user_id = :'h' and kind = 'host.new_booking'), '호스트에게 새 신청 알림');
select throws_ok($$ insert into public.payments (booking_id, order_id, amount, mode) values (gen_random_uuid(), 'L', 1, 'live') $$, '23514', null, '실결제(live) 기록은 DB에서 거부');

-- 알림은 본인 것만
select pg_temp.login_as(:'q');
select is((select count(*)::int from public.notifications), 0, '다른 사람의 알림은 볼 수 없다');
select pg_temp.logout();

-- ---------- 결제한 신청 취소 → 환불 ----------
select pg_temp.login_as(:'p');
select throws_ok($$ select public.cancel_booking(current_setting('t.bid')::uuid) $$, 'P0001', null, '결제한 신청은 환불 절차로만 취소');
select pg_temp.logout();
select pg_temp.login_service();
select throws_ok(format($$ select public.refund_booking(current_setting('t.bid')::uuid, %L, 'cancelled_by_user', '남의 신청') $$, :'q'), '42501', null, '다른 사람의 신청은 환불할 수 없다');
select is(public.refund_booking(current_setting('t.bid')::uuid, :'p', 'cancelled_by_user', '개인 사정'), 40000, '전액 환불');
select pg_temp.logout();
select is((select status::text || '/' || refunded_amount from public.payments where booking_id = current_setting('t.bid')::uuid), 'refunded/40000', '환불 기록');
select is((select reserved_count::int from public.meetup_sessions where id = current_setting('t.sid')::uuid), 0, '환불 후 자리 반환');
select is((select count(*)::int from public.payment_events pe join public.payments p on p.id = pe.payment_id where p.booking_id = current_setting('t.bid')::uuid), 3, '결제 이력 3건 (생성·결제·환불)');
select throws_ok($$ delete from public.payment_events $$, '42501', null, '결제 이력은 삭제할 수 없다');

-- ---------- 결제 대기 만료 ----------
select pg_temp.login_as(:'q');
select set_config('t.qb', public.book_session(current_setting('t.sid')::uuid, 1)::text, false);
select pg_temp.logout();
update public.bookings set hold_expires_at = now() - interval '1 minute' where id = current_setting('t.qb')::uuid;
select pg_temp.login_service();
select is(public.confirm_payment(current_setting('t.qb')::uuid, 'mock', 'mock_2', 20000), 'expired', '결제 시간이 지나면 확정 대신 만료');
select pg_temp.logout();
select is((select status::text from public.bookings where id = current_setting('t.qb')::uuid), 'expired', '만료 처리');
select is((select reserved_count::int from public.meetup_sessions where id = current_setting('t.sid')::uuid), 0, '만료 시 자리 반환');

-- ---------- 호스트 일정 취소 ----------
select pg_temp.login_as(:'q');
select set_config('t.qb2', public.book_session(current_setting('t.sid')::uuid, 1)::text, false);
select pg_temp.logout();
select pg_temp.login_service();
select is(public.confirm_payment(current_setting('t.qb2')::uuid, 'mock', 'mock_3', 20000), 'confirmed', '두 번째 결제 확정');
select pg_temp.logout();
select pg_temp.login_as(:'p');
select throws_ok($$ select public.host_cancel_session(current_setting('t.sid')::uuid, '호스트 사정으로 취소') $$, 'P0002', null, '호스트가 아니면 일정 취소 불가');
select pg_temp.logout();
select pg_temp.login_as(:'h');
select throws_ok($$ select public.host_cancel_session(current_setting('t.sid')::uuid, '호스트 사정으로 취소') $$, 'P0001', null, '결제 완료 신청이 있으면 환불 먼저');
select is((select count(*)::int from public.host_session_paid_bookings(current_setting('t.sid')::uuid)), 1, '호스트는 환불할 결제 목록을 볼 수 있다');
select pg_temp.logout();
select pg_temp.login_service();
select is(public.refund_booking(current_setting('t.qb2')::uuid, :'h', 'cancelled_by_host', '호스트 사정으로 취소'), 20000, '호스트 취소 전액 환불');
select pg_temp.logout();
select pg_temp.login_as(:'h');
select lives_ok($$ select public.host_cancel_session(current_setting('t.sid')::uuid, '호스트 사정으로 취소') $$, '환불 후 일정 취소');
select pg_temp.logout();
select is((select status::text from public.meetup_sessions where id = current_setting('t.sid')::uuid), 'cancelled', '일정 취소됨');
select ok(exists(select 1 from public.notifications where user_id = :'q' and kind = 'booking.cancelled_by_host'), '참가자에게 호스트 취소 알림');

-- ---------- 회원 탈퇴 ----------
select pg_temp.login_as(:'p');
select lives_ok($$ select public.withdraw_my_account() $$, '참가자 탈퇴');
select pg_temp.logout();
select is((select status::text from public.profiles where id = :'p'), 'withdrawn', '회원 상태 탈퇴');
select ok((select nickname like '탈퇴회원 %' and bio is null from public.profiles where id = :'p'), '닉네임 익명화');
select ok((select phone is null and birth_year is null from public.profile_private where user_id = :'p'), '연락처·출생연도 삭제');
select ok((select email like 'withdrawn+%@deleted.invalid' and banned_until > now() from auth.users where id = :'p'), '로그인 이메일 익명화·로그인 차단');
select ok(exists(select 1 from public.bookings where user_id = :'p'), '거래 기록은 보관 (익명 회원으로 연결)');

-- 참가자가 있는 호스트는 탈퇴 전에 일정 취소 필요
select set_config('t.sid2', pg_temp.published_session(:'h', 0, 5)::text, false);
select pg_temp.login_as(:'q');
select public.book_session(current_setting('t.sid2')::uuid, 1);
select pg_temp.logout();
select pg_temp.login_as(:'h');
select throws_ok($$ select public.withdraw_my_account() $$, 'P0001', null, '참가자가 있는 호스트는 바로 탈퇴할 수 없다');
select pg_temp.logout();

-- 참가자가 없는 호스트 탈퇴: 경력·자격·포트폴리오도 삭제
select pg_temp.create_member('h2@test.local', 'hostTwo') as h2 \gset
insert into public.host_profiles (user_id, display_name, status, career, credentials, portfolio_url, teaching_experience)
values (:'h2', '두 번째 호스트', 'approved', '디자인 회사 아트디렉터 10년 경력입니다', '공모전 수상', 'https://example.com/me', '클래스 20회');
select pg_temp.login_as(:'h2');
select lives_ok($$ select public.withdraw_my_account() $$, '참가자가 없는 호스트 탈퇴');
select pg_temp.logout();
select ok((select career = '' and credentials = '' and portfolio_url is null and teaching_experience = '' and display_name = '탈퇴한 호스트'
           from public.host_profiles where user_id = :'h2'), '호스트 전문성 정보(경력·자격·포트폴리오)도 삭제');

select * from finish();
rollback;
