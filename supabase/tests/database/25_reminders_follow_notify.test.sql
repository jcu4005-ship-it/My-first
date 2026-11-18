-- 하루 전 알림(한 번만, 회원은 직접 실행 불가) · 예약 작업 등록 · 팔로워 새 프로그램 알림(처음 공개 때만)
begin;
\ir _helpers.psql
select plan(11);

select pg_temp.create_member('rmh@test.local', 'remindHost') as h \gset
select pg_temp.create_member('rmp@test.local', 'remindPart') as p \gset
select pg_temp.create_member('rmf@test.local', 'remindFan') as f \gset
select pg_temp.published_session(:'h', 0, 6) as s \gset

select pg_temp.login_as(:'p');
select public.book_session(:'s', 1);
select throws_ok($$ select private.send_session_reminders() $$, '42501', null, '회원은 알림 작업을 직접 실행할 수 없다');
select pg_temp.logout();

select ok(exists (select 1 from cron.job where jobname = 'roundi-session-reminders' and schedule = '7 * * * *'), '매시 7분 예약 작업 등록');

-- 5일 뒤 일정: 아직 알림 없음
select is(private.send_session_reminders(), 0, '24시간보다 먼 일정은 알림 없음');
-- 20시간 뒤로 당김
update public.meetup_sessions set starts_at = now() + interval '20 hours', ends_at = now() + interval '22 hours' where id = :'s';
select is(private.send_session_reminders(), 2, '참가자 1 + 호스트 1 알림');
select ok(exists (select 1 from public.notifications where user_id = :'p' and kind = 'session.reminder'), '참가자 하루 전 알림');
select ok(exists (select 1 from public.notifications where user_id = :'h' and kind = 'session.host_reminder' and body like '%확정 1명%'), '호스트 하루 전 알림(확정 인원)');
select is(private.send_session_reminders(), 0, '같은 일정은 다시 보내지 않는다');

-- 팔로워 알림
insert into public.host_follows (follower_id, host_id) values (:'f', :'h');
insert into public.meetups (host_id, category_slug, title, summary, description, price, max_quantity_per_booking, status)
values (:'h', 'writing', '팔로워 알림 시험 프로그램', '팔로워 알림 시험 요약입니다', '팔로워 알림 시험 설명입니다. 충분히 길게 적습니다.', 0, 1, 'pending_review')
returning id as m2 \gset
select is((select count(*)::int from public.notifications where user_id = :'f' and kind = 'follow.new_program'), 0, '검수 중에는 알림 없음');
update public.meetups set status = 'published', published_at = now() where id = :'m2';
select is((select count(*)::int from public.notifications where user_id = :'f' and kind = 'follow.new_program'), 1, '처음 공개되면 팔로워에게 알림');
update public.meetups set status = 'suspended' where id = :'m2';
update public.meetups set status = 'published' where id = :'m2';
select is((select count(*)::int from public.notifications where user_id = :'f' and kind = 'follow.new_program'), 1, '다시 공개될 때는 또 보내지 않는다');
select is((select count(*)::int from public.notifications where user_id = :'h' and kind = 'follow.new_program'), 0, '호스트 본인에게는 보내지 않는다');

select * from finish();
rollback;
