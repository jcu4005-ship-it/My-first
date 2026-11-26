-- 1) 프로그램 하루 전 알림 (DB 예약 작업 pg_cron, 매시 7분)
-- 2) 팔로우한 크리에이터가 새 프로그램을 처음 공개하면 팔로워에게 알림
-- 알림은 사이트 안 알림(notifications)만 — 이메일·문자는 보내지 않음

------------------------------------------------------------------------------
-- 1. 하루 전 알림
------------------------------------------------------------------------------
alter table public.bookings add column reminded_at timestamptz;
alter table public.meetup_sessions add column host_reminded_at timestamptz;

create function private.send_session_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_count integer := 0;
begin
  -- 참가자: 24시간 안에 시작하는 확정 신청, 한 번만
  for r in
    select b.id, b.user_id, s.starts_at, s.area, s.venue_name, m.title
      from public.bookings b
      join public.meetup_sessions s on s.id = b.session_id
      join public.meetups m on m.id = s.meetup_id
     where b.status = 'confirmed' and b.reminded_at is null
       and s.status in ('open', 'closed') and m.status = 'published' and not m.is_sample
       and s.starts_at > now() and s.starts_at <= now() + interval '24 hours'
     for update of b skip locked
  loop
    perform private.notify(r.user_id, 'session.reminder', '내일 참여하는 프로그램이 있어요',
      left(r.title, 40) || ' · ' || to_char(r.starts_at at time zone 'Asia/Seoul', 'MM/DD HH24:MI') || ' · ' || r.area || ' ' || r.venue_name,
      '/me/bookings');
    update public.bookings set reminded_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;

  -- 호스트: 확정 참가자가 있는 일정, 일정당 한 번
  for r in
    select s.id, m.host_id, s.starts_at, m.id as meetup_id, m.title,
           (select coalesce(sum(quantity), 0) from public.bookings where session_id = s.id and status = 'confirmed') as people
      from public.meetup_sessions s
      join public.meetups m on m.id = s.meetup_id
     where s.host_reminded_at is null and s.status in ('open', 'closed') and m.status = 'published' and not m.is_sample
       and s.starts_at > now() and s.starts_at <= now() + interval '24 hours'
     for update of s skip locked
  loop
    if r.people > 0 then
      perform private.notify(r.host_id, 'session.host_reminder', '내일 프로그램이 열려요',
        left(r.title, 40) || ' · ' || to_char(r.starts_at at time zone 'Asia/Seoul', 'MM/DD HH24:MI') || ' · 확정 ' || r.people || '명',
        '/host/meetups/' || r.meetup_id);
      v_count := v_count + 1;
    end if;
    update public.meetup_sessions set host_reminded_at = now() where id = r.id;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.send_session_reminders() from public, anon, authenticated;

-- 예약 작업 등록 (이미 있으면 바꿔 등록)
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'roundi-session-reminders') then
    perform cron.unschedule('roundi-session-reminders');
  end if;
  perform cron.schedule('roundi-session-reminders', '7 * * * *', 'select private.send_session_reminders()');
end;
$$;

------------------------------------------------------------------------------
-- 2. 팔로우한 크리에이터의 새 프로그램 (처음 공개될 때 한 번)
------------------------------------------------------------------------------
create function private.notify_followers_on_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_test boolean;
  f record;
begin
  if new.status = 'published' and old.published_at is null and new.published_at is not null and not new.is_sample then
    select display_name, is_test into v_name, v_test from public.host_profiles where user_id = new.host_id;
    if coalesce(v_test, false) then
      return new;
    end if;
    for f in select follower_id from public.host_follows where host_id = new.host_id loop
      perform private.notify(f.follower_id, 'follow.new_program', v_name || '님의 새 프로그램',
        left(new.title, 60), '/meetups/' || new.id);
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.notify_followers_on_publish() from public, anon, authenticated;
create trigger meetups_notify_followers after update of status on public.meetups
  for each row execute function private.notify_followers_on_publish();
