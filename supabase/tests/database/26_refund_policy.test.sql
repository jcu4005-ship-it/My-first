-- 플랫폼 환불 기준: 3일 전 100% · 2~1일 전 50% · 당일 0% (참가자 취소), 호스트 취소는 항상 100%
begin;
\ir _helpers.psql
select plan(12);

select pg_temp.create_member('rph@test.local', 'refundHost') as h \gset
select pg_temp.create_member('rpp@test.local', 'refundPart') as p \gset
select pg_temp.published_session(:'h', 30000, 6) as s \gset

-- 한국 날짜 기준 일수 계산
select is(private.refund_percent(now() + interval '5 days'), 100, '5일 전 100%');
select is(private.refund_percent(((now() at time zone 'Asia/Seoul')::date + 2 + time '12:00') at time zone 'Asia/Seoul'), 50, '2일 전 50%');
select is(private.refund_percent(((now() at time zone 'Asia/Seoul')::date + 1 + time '00:30') at time zone 'Asia/Seoul'), 50, '1일 전(다음날 새벽) 50%');
select is(private.refund_percent(((now() at time zone 'Asia/Seoul')::date + time '23:30') at time zone 'Asia/Seoul'), 0, '당일 0%');

select pg_temp.login_as(:'p');
select throws_ok($$ select private.refund_percent(now()) $$, '42501', null, '회원은 계산 함수를 직접 부를 수 없다');
select throws_ok(format($$ select public.refund_amount_for(%L, 'cancelled_by_user') $$, :'s'), '42501', null, '회원은 환불 금액 함수를 부를 수 없다');
select public.book_session(:'s', 1) as b \gset
select pg_temp.logout();
select pg_temp.login_service();
select public.confirm_payment(:'b', 'mock', 'mock_rp1', 30000);
select pg_temp.logout();

-- 2일 전으로 옮기면 50%
update public.meetup_sessions set starts_at = ((now() at time zone 'Asia/Seoul')::date + 2 + time '19:00') at time zone 'Asia/Seoul',
  ends_at = ((now() at time zone 'Asia/Seoul')::date + 2 + time '21:00') at time zone 'Asia/Seoul' where id = :'s';
select pg_temp.login_service();
select is(public.refund_amount_for(:'b', 'cancelled_by_user'), 15000, '참가자 취소 2일 전: 미리 계산 15,000원');
select is(public.refund_amount_for(:'b', 'cancelled_by_host'), 30000, '호스트 취소는 전액');
select is(public.refund_booking(:'b', :'p', 'cancelled_by_user', '개인 사정'), 15000, '참가자 취소 50% 환불');
select pg_temp.logout();
select is((select refunded_amount from public.payments where booking_id = :'b'), 15000, '결제 기록에 부분 환불');
select ok(exists (select 1 from public.notifications where user_id = :'p' and kind = 'booking.refunded' and body like '%15000원 (50%%%'), '참가자 알림에 환불액·비율');
select is((select gross_amount from public.settlements where booking_id = :'b'), 15000, '남은 금액은 정산 대상');

select * from finish();
rollback;
