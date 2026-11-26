-- 결제하지 않고 떠난 사람의 자리 잡기(10분)는 아무도 신청하지 않아도 자동으로 풀려야 한다 (예약 작업)
begin;
\ir _helpers.psql
select plan(8);

select pg_temp.create_member('eh@test.local', 'expHost') as h \gset
select pg_temp.create_member('ep@test.local', 'expP') as p \gset
select pg_temp.create_member('eq@test.local', 'expQ') as q \gset
select set_config('t.sid', pg_temp.published_session(:'h', 20000, 1)::text, false);

-- p 가 마지막 1자리를 잡고 결제 없이 떠남
select pg_temp.login_as(:'p');
select lives_ok($$ select set_config('t.bid', public.book_session(current_setting('t.sid')::uuid, 1)::text, false) $$, '마지막 1자리를 잡는다');
select pg_temp.logout();
update public.bookings set hold_expires_at = now() - interval '1 minute' where id = current_setting('t.bid')::uuid;
select is((select reserved_count::int from public.meetup_sessions where id = current_setting('t.sid')::uuid), 1, '10분이 지나도 (정리 전에는) 자리가 찬 것으로 남아 있다');

-- 예약 작업이 도는 것과 같은 함수를 실행
select is((select private.expire_all_holds()), 1, '예약 작업: 만료된 자리 잡기 1건 정리');
select is((select reserved_count::int from public.meetup_sessions where id = current_setting('t.sid')::uuid), 0, '아무도 신청하지 않아도 자리가 돌아온다');
select is((select status::text from public.bookings where id = current_setting('t.bid')::uuid), 'expired', '신청은 만료 처리');
select is((select private.expire_all_holds()), 0, '다시 실행해도 안전하다 (정리할 것이 없으면 0건)');

-- 이제 다른 사람이 신청할 수 있다
select pg_temp.login_as(:'q');
select lives_ok($$ select public.book_session(current_setting('t.sid')::uuid, 1) $$, '풀린 자리에 다른 사람이 신청할 수 있다');
select pg_temp.logout();
select ok(exists (select 1 from cron.job where jobname = 'roundi-expire-holds' and schedule = '* * * * *'), '매분 예약 작업 등록');

select * from finish();
rollback;
