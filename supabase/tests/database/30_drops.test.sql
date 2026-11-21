-- 드롭(열림 시각): 열리기 전 신청 불가(DB), 호스트만 정함, 알림 신청은 본인만·함수로만, 알림은 일정당 한 번
begin;
\ir _helpers.psql
select plan(23);

select pg_temp.create_member('dph@test.local', 'dropHost') as h \gset
select pg_temp.create_member('dpx@test.local', 'dropOther') as x \gset
select pg_temp.create_member('dp1@test.local', 'dropOne') as p1 \gset
select pg_temp.create_member('dp2@test.local', 'dropTwo') as p2 \gset
select pg_temp.create_member('dpf@test.local', 'dropFollower') as f \gset
select pg_temp.published_session(:'h', 0, 4, 2) as s \gset
select pg_temp.published_session(:'h', 0, 4, 2) as s_plain \gset

-- 1. 열림 시각이 없는 일정은 지금처럼 바로 신청 (기존 동작 보존)
select pg_temp.login_as(:'p2');
select lives_ok(format($$ select public.book_session(%L, 1) $$, :'s_plain'), '열림 시각이 없는 일정은 바로 신청된다');
select pg_temp.logout();

-- 2. 호스트가 열림 시각 정하기
select pg_temp.login_as(:'x');
select throws_ok(format($$ select public.host_set_session_opens_at(%L, now() + interval '2 days') $$, :'s'), 'P0002', null, '다른 사람(호스트 아님)은 정할 수 없다');
select pg_temp.logout();

select pg_temp.login_as(:'h');
select throws_ok(format($$ select public.host_set_session_opens_at(%L, now() - interval '1 hour') $$, :'s'), '22023', null, '과거 시각은 안 된다');
select throws_ok(format($$ select public.host_set_session_opens_at(%L, now() + interval '6 days') $$, :'s'), '22023', null, '프로그램 시작보다 뒤는 안 된다');
select lives_ok(format($$ select public.host_set_session_opens_at(%L, now() + interval '2 days') $$, :'s'), '호스트는 열림 시각을 정할 수 있다');
select pg_temp.logout();

-- 3. 열리기 전: 신청 불가 (DB가 막음), 열림 시각은 누구나 볼 수 있음, 알림 관련 열은 못 봄
select pg_temp.login_as(:'p1');
select throws_ok(format($$ select public.book_session(%L, 1) $$, :'s'), 'P0001', null, '열리기 전에는 신청할 수 없다');
select pg_temp.logout();
select pg_temp.login_anon();
select ok((select opens_at is not null from public.meetup_sessions where id = :'s'), '열림 시각은 비로그인도 볼 수 있다');
select throws_ok($$ select open_notified_at from public.meetup_sessions $$, '42501', null, '알림 기록 열은 읽을 수 없다');
select pg_temp.logout();

-- 4. 열리면 알림 받기: 본인만, 함수로만
select pg_temp.login_anon();
select throws_ok(format($$ select public.set_open_alert(%L, true) $$, :'s'), '42501', null, '비로그인은 알림 신청 불가');
select pg_temp.logout();
select pg_temp.login_as(:'p1');
select throws_ok(format($$ select public.set_open_alert(%L, true) $$, :'s_plain'), '22023', null, '이미 열린 일정은 알림 신청 불가');
select lives_ok(format($$ select public.set_open_alert(%L, true) $$, :'s'), '열리기 전 일정은 알림 신청');
select throws_ok($$ select * from public.session_open_alerts $$, '42501', null, '알림 신청 표는 직접 읽을 수 없다');
select is((select count(*)::int from public.my_open_alerts()), 1, '내 알림 목록에 보인다');
select pg_temp.logout();
select pg_temp.login_as(:'p2');
select is((select count(*)::int from public.my_open_alerts()), 0, '다른 사람의 알림 신청은 보이지 않는다');
select pg_temp.logout();

-- 5. 알림: 1시간 전은 알림 신청자만, 한 번만
insert into public.host_follows (follower_id, host_id) values (:'f', :'h');
update public.meetup_sessions set opens_at = now() + interval '30 minutes' where id = :'s';
select private.send_open_alerts();
select is((select count(*)::int from public.notifications where kind = 'drop.soon' and user_id = :'p1'), 1, '열리기 1시간 전: 알림 신청자에게 알림');
select is((select count(*)::int from public.notifications where kind = 'drop.soon' and user_id = :'f'), 0, '1시간 전 알림은 팔로워에게 가지 않는다');
select private.send_open_alerts();
select is((select count(*)::int from public.notifications where kind = 'drop.soon' and user_id = :'p1'), 1, '다시 돌려도 중복 알림 없음');

-- 6. 열린 순간: 알림 신청자 + 팔로워, 호스트 제외, 한 번만
update public.meetup_sessions set opens_at = now() - interval '1 minute' where id = :'s';
select private.send_open_alerts();
select is((select count(*)::int from public.notifications where kind = 'drop.opened' and user_id in (:'p1', :'f')), 2, '열린 순간: 알림 신청자와 팔로워에게 알림');
select is((select count(*)::int from public.notifications where kind = 'drop.opened' and user_id = :'h'), 0, '호스트에게는 보내지 않는다');
select private.send_open_alerts();
select is((select count(*)::int from public.notifications where kind = 'drop.opened' and user_id in (:'p1', :'f')), 2, '다시 돌려도 중복 알림 없음');

-- 7. 열린 뒤에는 신청 가능
select pg_temp.login_as(:'p1');
select lives_ok(format($$ select public.book_session(%L, 1) $$, :'s'), '열린 뒤에는 신청된다');
select pg_temp.logout();

-- 8. 이미 신청이 있는 일정은 열림 시각을 정할 수 없고, 지울 수는 있다
select pg_temp.login_as(:'h');
select throws_ok(format($$ select public.host_set_session_opens_at(%L, now() + interval '2 days') $$, :'s'), '22023', null, '신청이 있는 일정은 열림 시각을 새로 정할 수 없다');
select lives_ok(format($$ select public.host_set_session_opens_at(%L, null) $$, :'s'), '열림 시각 지우기는 가능');
select pg_temp.logout();

select * from finish();
rollback;
