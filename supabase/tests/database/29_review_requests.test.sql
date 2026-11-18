-- 후기 요청 알림: 끝나고 2시간 뒤 한 번, 불참·후기 쓴 사람 제외, 회원은 직접 실행 불가
begin;
\ir _helpers.psql
select plan(7);

select pg_temp.create_member('rqh@test.local', 'reqHost') as h \gset
select pg_temp.create_member('rqp@test.local', 'reqPart') as p \gset
select pg_temp.create_member('rqa@test.local', 'reqAbsent') as a \gset
select pg_temp.published_session(:'h', 0, 6) as s \gset

select pg_temp.login_as(:'p');
select public.book_session(:'s', 1) as bp \gset
select throws_ok($$ select private.send_review_requests() $$, '42501', null, '회원은 직접 실행할 수 없다');
select pg_temp.logout();
select pg_temp.login_as(:'a');
select public.book_session(:'s', 1) as ba \gset
select pg_temp.logout();

select ok(exists (select 1 from cron.job where jobname = 'roundi-review-requests' and schedule = '37 * * * *'), '매시 37분 예약 작업');

-- 아직 안 끝난 일정: 요청 없음
select private.send_review_requests();
select is((select count(*)::int from public.notifications where user_id in (:'p', :'a') and kind = 'review.request'), 0, '끝나기 전에는 요청 없음');

-- 3시간 전에 끝난 것으로, 한 명은 불참 처리
update public.meetup_sessions set starts_at = now() - interval '5 hours', ends_at = now() - interval '3 hours' where id = :'s';
update public.bookings set attended = false where id = :'ba';
select private.send_review_requests();
select is((select count(*)::int from public.notifications where user_id = :'p' and kind = 'review.request'), 1, '참석자에게 후기 요청');
select is((select count(*)::int from public.notifications where user_id = :'a' and kind = 'review.request'), 0, '불참 처리된 사람은 제외');
select private.send_review_requests();
select is((select count(*)::int from public.notifications where user_id = :'p' and kind = 'review.request'), 1, '한 번만 보낸다');
select is((select link from public.notifications where user_id = :'p' and kind = 'review.request'), '/me/reviews', '후기 쓰는 화면으로 연결');

select * from finish();
rollback;
