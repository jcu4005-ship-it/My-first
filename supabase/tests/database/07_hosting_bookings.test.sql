-- 호스트 신청·승인 → 모임 등록·검수 → 공개 → 참가 신청·취소 (무료 모임: 즉시 확정), 권한·정원·중복
begin;
\ir _helpers.psql
select plan(40);

select pg_temp.create_member('h@test.local', 'hostApplicant') as h \gset
select pg_temp.create_member('p@test.local', 'participantP') as p \gset
select pg_temp.create_member('q@test.local', 'participantQ') as q \gset
select pg_temp.create_member('adm@test.local', 'adminZ') as adm \gset
select pg_temp.grant_role_direct(:'adm', 'admin');

-- ---------- 호스트 신청 ----------
select pg_temp.login_as(:'h');
select lives_ok($$ select public.apply_host('테스트 호스트', '한 줄 소개', '소개', array['독서'], null) $$, '회원은 호스트 신청 가능');
select throws_ok($$ select public.apply_host('테스트 호스트', '', '', null, null) $$, '22023', null, '중복 신청 불가');
select throws_ok($$ insert into public.meetups (host_id, category_slug, title, summary, description, price) values (auth.uid(), 'reading', '승인 전 모임 등록', '승인 전 모임 등록 요약입니다', '승인 전 모임 등록 상세 설명입니다.', 0) $$,
  '42501', null, '승인 전에는 모임을 만들 수 없다');
select throws_ok($$ select public.admin_review_host(auth.uid(), true, null) $$, '42501', null, '스스로 승인할 수 없다');
select throws_ok($$ update public.host_profiles set status = 'approved' where user_id = auth.uid() $$, '42501', null, '승인 상태를 직접 바꿀 수 없다');
select pg_temp.logout();

-- ---------- 관리자 승인 ----------
select pg_temp.login_as(:'adm', 'aal1');
select throws_ok(format($$ select public.admin_review_host(%L, true, null) $$, :'h'), '42501', null, '2단계 인증 전 관리자는 승인 불가');
select pg_temp.logout();
select pg_temp.login_as(:'adm', 'aal2');
select throws_ok(format($$ select public.admin_review_host(%L, false, '짧') $$, :'h'), '22023', null, '반려 사유 5자 미만 거부');
select lives_ok(format($$ select public.admin_review_host(%L, true, null) $$, :'h'), '관리자 승인');
select pg_temp.logout();
select ok(exists(select 1 from public.user_roles where user_id = :'h' and role = 'host'), '승인 시 host 역할 부여');
select ok(exists(select 1 from public.audit_logs where action = 'host.approve' and target_id = :'h'), '승인 감사 기록');

-- ---------- 모임 등록·회차·검수 요청 ----------
select pg_temp.login_as(:'h');
select lives_ok($$ insert into public.meetups (host_id, category_slug, title, summary, description, price, max_quantity_per_booking)
  values (auth.uid(), 'reading', '테스트 독서 모임입니다', '테스트 독서 모임의 요약입니다', '테스트 독서 모임의 상세 설명입니다.', 0, 2) $$,
  '승인된 호스트는 모임을 만들 수 있다');
select pg_temp.logout();
select set_config('t.mid', id::text, false) from public.meetups where title = '테스트 독서 모임입니다';
select pg_temp.login_as(:'h');
select throws_ok($$ insert into public.meetups (host_id, category_slug, title, summary, description, price, status)
  values (auth.uid(), 'reading', '바로 공개 시도 모임', '바로 공개 시도 모임 요약입니다', '바로 공개 시도 모임 상세 설명입니다.', 0, 'published') $$,
  '42501', null, '호스트는 공개 상태로 직접 만들 수 없다');
select throws_ok($$ update public.meetups set status = 'published' where id = current_setting('t.mid')::uuid $$,
  '42501', null, '호스트는 공개 상태로 직접 바꿀 수 없다');
select throws_ok($$ select public.host_set_meetup_status(current_setting('t.mid')::uuid, 'submit') $$,
  '22023', null, '일정 없이 검수 요청 불가');
select lives_ok(format($$ insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity)
  values (%L, now() + interval '5 days', now() + interval '5 days 2 hours', '성수동', '테스트 책방', '서울 성동구 비밀주소 1', 3) $$, current_setting('t.mid')::uuid),
  '호스트는 일정을 추가할 수 있다');
select pg_temp.logout();
select set_config('t.sid', id::text, false) from public.meetup_sessions where meetup_id = current_setting('t.mid')::uuid;
select pg_temp.login_as(:'h');
select throws_ok(format($$ insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, capacity)
  values (%L, now() - interval '1 day', now() - interval '20 hours', '성수동', '테스트 책방', 3) $$, current_setting('t.mid')::uuid),
  '42501', null, '지난 날짜 일정은 추가할 수 없다');
select is(public.host_set_meetup_status(current_setting('t.mid')::uuid, 'submit'), 'pending_review'::public.meetup_status, '검수 요청');
select pg_temp.logout();

-- 다른 회원은 남의 모임·일정 수정 불가
select pg_temp.login_as(:'p');
select lives_ok($$ update public.meetups set title = '탈취 시도 제목입니다' where id = current_setting('t.mid')::uuid $$, '남의 모임 수정 시도');
select pg_temp.logout();
select is((select title from public.meetups where id = current_setting('t.mid')::uuid), '테스트 독서 모임입니다', '남의 모임은 바뀌지 않는다');

-- 공개 전 신청 불가
select pg_temp.login_as(:'p');
select throws_ok($$ select public.book_session(current_setting('t.sid')::uuid, 1) $$, 'P0001', null, '공개 전 모임은 신청 불가');
select pg_temp.logout();

-- ---------- 관리자 공개 ----------
select pg_temp.login_as(:'adm', 'aal2');
select is(public.admin_review_meetup(current_setting('t.mid')::uuid, 'publish', null), 'published'::public.meetup_status, '관리자 공개');
select pg_temp.logout();
select ok(exists(select 1 from public.audit_logs where action = 'meetup.publish'), '공개 감사 기록');

-- ---------- 참가 신청 ----------
select pg_temp.login_as(:'p');
select throws_ok($$ select public.book_session(current_setting('t.sid')::uuid, 3) $$, 'P0001', null, '1회 최대 인원 초과 거부');
select lives_ok($$ select public.book_session(current_setting('t.sid')::uuid, 2) $$, '2명 신청');
select throws_ok($$ select public.book_session(current_setting('t.sid')::uuid, 1) $$, 'P0001', null, '같은 일정 중복 신청 거부');
select throws_ok($$ insert into public.bookings (session_id, user_id, quantity, unit_price, total_price) values (current_setting('t.sid')::uuid, auth.uid(), 1, 0, 0) $$,
  '42501', null, '신청 표에 직접 추가 불가 (무료로 만들기 등)');
select lives_ok($$ update public.meetup_sessions set capacity = 100 where id = current_setting('t.sid')::uuid $$, '참가자의 정원 변경 시도');
select is((select count(*)::int from public.my_bookings() where address_detail = '서울 성동구 비밀주소 1'), 1, '확정 신청자는 상세 주소를 볼 수 있다');
select pg_temp.logout();

select is((select reserved_count::int from public.meetup_sessions where id = current_setting('t.sid')::uuid), 2, '예약 인원 2 반영');
select is((select capacity::int from public.meetup_sessions where id = current_setting('t.sid')::uuid), 3, '참가자는 정원을 바꿀 수 없다 (그대로 3)');

select pg_temp.login_as(:'q');
select throws_ok($$ select public.book_session(current_setting('t.sid')::uuid, 2) $$, 'P0001', null, '남은 자리(1) 초과 신청 거부');
select lives_ok($$ select public.book_session(current_setting('t.sid')::uuid, 1) $$, '마지막 1자리 신청');
select is_empty(format($$ select 1 from public.bookings where user_id = %L $$, :'p'), '다른 참가자의 신청은 볼 수 없다');
select pg_temp.logout();

-- 호스트: 참가자 확인 (닉네임만), 참가비 변경 차단
select pg_temp.login_as(:'h');
select is((select count(*)::int from public.host_meetup_participants(current_setting('t.mid')::uuid)), 2, '호스트는 자기 모임 참가자를 볼 수 있다');
select throws_ok($$ update public.meetups set price = 1000 where id = current_setting('t.mid')::uuid $$, '22023', null, '확정 신청이 있으면 참가비 변경 불가');
select throws_ok($$ select public.book_session(current_setting('t.sid')::uuid, 1) $$, 'P0001', null, '호스트는 자기 모임에 신청 불가');
select pg_temp.logout();

-- 다른 회원은 남의 모임 참가자 조회 불가
select pg_temp.login_as(:'p');
select is((select count(*)::int from public.host_meetup_participants(current_setting('t.mid')::uuid)), 0, '호스트가 아니면 참가자 목록을 볼 수 없다');
-- 취소 → 자리 반환
select lives_ok(format($$ select public.cancel_booking((select id from public.bookings where user_id = %L)) $$, :'p'), '참가자 취소');
select pg_temp.logout();
select is((select reserved_count::int from public.meetup_sessions where id = current_setting('t.sid')::uuid), 1, '취소 후 자리 반환');

-- 샘플 모임 신청 불가
select pg_temp.login_as(:'q');
select throws_ok($$ select public.book_session((select s.id from public.meetup_sessions s join public.meetups m on m.id = s.meetup_id where m.is_sample and m.status = 'published' and s.starts_at > now() and s.reserved_count < s.capacity limit 1), 1) $$,
  'P0001', null, '샘플 모임은 신청할 수 없다');
select pg_temp.logout();

select * from finish();
rollback;
