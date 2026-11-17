-- 대기 신청: 마감된 일정만, 본인만, 자리가 나면 알림, 신청하면 대기에서 빠짐
begin;
\ir _helpers.psql
select plan(14);

select pg_temp.create_member('wlh@test.local', 'waitHost') as h \gset
select pg_temp.create_member('wl1@test.local', 'waitOne') as p1 \gset
select pg_temp.create_member('wl2@test.local', 'waitTwo') as p2 \gset
select pg_temp.create_member('wl3@test.local', 'waitThree') as p3 \gset
select pg_temp.published_session(:'h', 0, 1, 1) as s \gset

-- 자리가 있으면 대기 불가
select pg_temp.login_as(:'p2');
select throws_ok(format($$ select public.join_waitlist(%L) $$, :'s'), '22023', null, '자리가 있으면 대기 대신 바로 신청');
select pg_temp.logout();

select pg_temp.login_as(:'p1');
select public.book_session(:'s', 1) as b1 \gset
select throws_ok(format($$ select public.join_waitlist(%L) $$, :'s'), '22023', null, '이미 신청한 사람은 대기 불가');
select pg_temp.logout();

select pg_temp.login_anon();
select throws_ok(format($$ select public.join_waitlist(%L) $$, :'s'), '42501', null, '비로그인은 대기 불가');
select pg_temp.logout();

select pg_temp.login_as(:'h');
select throws_ok(format($$ select public.join_waitlist(%L) $$, :'s'), '22023', null, '호스트는 내 프로그램에 대기 불가');
select pg_temp.logout();

select pg_temp.login_as(:'p2');
select lives_ok(format($$ select public.join_waitlist(%L) $$, :'s'), '마감된 일정에 대기 신청');
select throws_ok($$ select * from public.waitlist_entries $$, '42501', null, '대기 표는 직접 읽을 수 없다');
select is((select count(*)::int from public.my_waitlist()), 1, '내 대기 목록에 보인다');
select pg_temp.logout();
select pg_temp.login_as(:'p3');
select lives_ok(format($$ select public.join_waitlist(%L) $$, :'s'), '두 번째 대기자');
select is((select count(*)::int from public.my_waitlist()), 1, '다른 사람의 대기는 보이지 않는다');
select pg_temp.logout();

-- 호스트는 인원 수만
select pg_temp.login_as(:'h');
select is((select waiting from public.host_waitlist_counts((select meetup_id from public.meetup_sessions where id = :'s'))), 2, '호스트는 대기 인원 수를 본다');
select pg_temp.logout();

-- 자리가 나면 대기자 모두에게 알림 (한 번만)
select pg_temp.login_as(:'p1');
select public.cancel_booking(:'b1');
select pg_temp.logout();
select is((select count(*)::int from public.notifications where kind = 'waitlist.seat' and user_id in (:'p2', :'p3')), 2, '취소로 자리가 나면 대기자 모두에게 알림');
update public.meetup_sessions set capacity = capacity + 1 where id = :'s';
select is((select count(*)::int from public.notifications where kind = 'waitlist.seat' and user_id in (:'p2', :'p3')), 2, '이미 알림 받은 대기자에게 다시 보내지 않는다');

-- 신청하면 대기에서 빠짐
select pg_temp.login_as(:'p2');
select public.book_session(:'s', 1);
select is((select count(*)::int from public.my_waitlist()), 0, '신청하면 대기에서 빠진다');
select pg_temp.logout();

-- 대기 취소
select pg_temp.login_as(:'p3');
select public.leave_waitlist(:'s');
select is((select count(*)::int from public.my_waitlist()), 0, '대기 취소');
select pg_temp.logout();

select * from finish();
rollback;
