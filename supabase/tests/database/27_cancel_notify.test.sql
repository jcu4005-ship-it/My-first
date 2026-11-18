-- 무료 신청 취소: 참가자 본인과 호스트 모두에게 알림
begin;
\ir _helpers.psql
select plan(3);

select pg_temp.create_member('cnh@test.local', 'cancelHost') as h \gset
select pg_temp.create_member('cnp@test.local', 'cancelPart') as p \gset
select pg_temp.published_session(:'h', 0, 6) as s \gset

select pg_temp.login_as(:'p');
select public.book_session(:'s', 1) as b \gset
select lives_ok(format($$ select public.cancel_booking(%L) $$, :'b'), '무료 신청 취소');
select pg_temp.logout();

select ok(exists (select 1 from public.notifications where user_id = :'p' and kind = 'booking.cancelled' and title = '신청을 취소했어요'), '참가자에게 취소 알림');
select ok(exists (select 1 from public.notifications where user_id = :'h' and kind = 'host.booking_cancelled'), '호스트에게도 알림');

select * from finish();
rollback;
