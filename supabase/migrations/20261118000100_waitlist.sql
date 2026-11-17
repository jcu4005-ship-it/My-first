-- 대기 신청: 자리가 다 찬 일정에 대기 → 자리가 나면(취소·정원 늘림) 대기자 모두에게 알림
-- 먼저 신청한 사람이 자리를 가져가요(자동 배정 없음 — 결제·인원 선택이 필요하므로).
-- 표 직접 접근 없음. 쓰기는 SECURITY DEFINER 함수와 트리거로만.

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.meetup_sessions (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);
create index waitlist_session_idx on public.waitlist_entries (session_id, created_at);
create index waitlist_user_idx on public.waitlist_entries (user_id, created_at desc);
alter table public.waitlist_entries enable row level security;
revoke all on public.waitlist_entries from public, anon, authenticated;

create function public.join_waitlist(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
begin
  if not private.is_active_member() then
    raise exception 'forbidden: 로그인이 필요합니다' using errcode = '42501';
  end if;
  select ms.id, ms.status, ms.starts_at, ms.capacity, ms.reserved_count, m.status as meetup_status, m.is_sample, m.host_id
    into s
    from public.meetup_sessions ms join public.meetups m on m.id = ms.meetup_id
   where ms.id = p_session_id;
  if not found or s.meetup_status <> 'published' then
    raise exception '일정을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if s.is_sample then
    raise exception '예시 프로그램은 대기 신청할 수 없어요' using errcode = '22023';
  end if;
  if s.host_id = auth.uid() then
    raise exception '내 프로그램에는 대기 신청할 수 없어요' using errcode = '22023';
  end if;
  if s.status <> 'open' or s.starts_at <= now() then
    raise exception '모집 중인 일정에만 대기 신청할 수 있어요' using errcode = '22023';
  end if;
  if s.reserved_count < s.capacity then
    raise exception '아직 자리가 있어요. 바로 신청해 주세요' using errcode = '22023';
  end if;
  if exists (select 1 from public.bookings where session_id = p_session_id and user_id = auth.uid() and status in ('confirmed', 'pending_payment')) then
    raise exception '이미 신청한 일정이에요' using errcode = '22023';
  end if;
  if (select count(*) from public.waitlist_entries where session_id = p_session_id) >= 30 then
    raise exception '대기 인원이 가득 찼어요' using errcode = '22023';
  end if;
  insert into public.waitlist_entries (session_id, user_id) values (p_session_id, auth.uid())
    on conflict (session_id, user_id) do update set notified_at = null, created_at = now();
end;
$$;
revoke all on function public.join_waitlist(uuid) from public, anon;
grant execute on function public.join_waitlist(uuid) to authenticated;

create function public.leave_waitlist(p_session_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.waitlist_entries where session_id = p_session_id and user_id = auth.uid();
$$;
revoke all on function public.leave_waitlist(uuid) from public, anon;
grant execute on function public.leave_waitlist(uuid) to authenticated;

-- 내 대기 목록 (다가오는 일정만)
create function public.my_waitlist()
returns table (session_id uuid, meetup_id uuid, title text, starts_at timestamptz, left_seats integer, notified_at timestamptz, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select w.session_id, m.id, m.title, s.starts_at, greatest(s.capacity - s.reserved_count, 0), w.notified_at, w.created_at
  from public.waitlist_entries w
  join public.meetup_sessions s on s.id = w.session_id
  join public.meetups m on m.id = s.meetup_id
  where w.user_id = auth.uid() and s.starts_at > now() and s.status <> 'cancelled'
  order by s.starts_at
$$;
revoke all on function public.my_waitlist() from public, anon;
grant execute on function public.my_waitlist() to authenticated;

-- 호스트: 일정별 대기 인원 수 (누가 기다리는지는 보여 주지 않음)
create function public.host_waitlist_counts(p_meetup_id uuid)
returns table (session_id uuid, waiting integer)
language sql
stable
security definer
set search_path = ''
as $$
  select w.session_id, count(*)::int
  from public.waitlist_entries w
  join public.meetup_sessions s on s.id = w.session_id
  join public.meetups m on m.id = s.meetup_id
  where m.id = p_meetup_id and m.host_id = auth.uid() and private.has_role('host')
  group by w.session_id
$$;
revoke all on function public.host_waitlist_counts(uuid) from public, anon;
grant execute on function public.host_waitlist_counts(uuid) to authenticated;

-- 자리가 생기면 아직 알림을 받지 않은 대기자에게 알림
create function private.notify_waitlist_on_free_seat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_meetup uuid;
  w record;
begin
  if new.status = 'open' and new.starts_at > now()
     and (new.capacity - new.reserved_count) > 0
     and (new.capacity - new.reserved_count) > greatest(old.capacity - old.reserved_count, 0) then
    select m.title, m.id into v_title, v_meetup from public.meetups m where m.id = new.meetup_id;
    for w in
      select id, user_id from public.waitlist_entries
       where session_id = new.id and notified_at is null
       order by created_at
       for update
    loop
      perform private.notify(w.user_id, 'waitlist.seat', '대기하던 일정에 자리가 났어요',
        left(v_title, 60) || ' — 먼저 신청한 분이 자리를 가져가요.', '/meetups/' || v_meetup);
      update public.waitlist_entries set notified_at = now() where id = w.id;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.notify_waitlist_on_free_seat() from public, anon, authenticated;
create trigger meetup_sessions_waitlist_notify after update of reserved_count, capacity, status on public.meetup_sessions
  for each row execute function private.notify_waitlist_on_free_seat();

-- 신청하면 그 일정의 대기에서 빠짐
create function private.clear_waitlist_on_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('confirmed', 'pending_payment') then
    delete from public.waitlist_entries where session_id = new.session_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;
revoke all on function private.clear_waitlist_on_booking() from public, anon, authenticated;
create trigger bookings_clear_waitlist after insert on public.bookings
  for each row execute function private.clear_waitlist_on_booking();
