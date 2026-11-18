-- 저장(찜)을 계정에 보관: 로그인하면 어느 기기에서나 같은 목록 (대표 요청 "참가자·호스트 모두 편하게")
-- - 본인 것만 읽고/쓰고/지움 (RLS). 공개 중인 프로그램만 새로 저장 가능
-- - 호스트는 "몇 명이 저장했는지" 숫자만 봄 (누가 저장했는지는 보이지 않음)

create table public.saved_meetups (
  user_id uuid not null references public.profiles (id) on delete cascade,
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, meetup_id)
);
create index saved_meetups_meetup_idx on public.saved_meetups (meetup_id);
alter table public.saved_meetups enable row level security;
revoke all on public.saved_meetups from public, anon, authenticated;
-- 표 직접 접근 없음: 읽기·쓰기 모두 아래 함수로만 (01번 보안 원칙)

-- 저장/취소 (본인만, 공개 중인 프로그램만 새로 저장)
create function public.set_meetup_saved(p_meetup_id uuid, p_saved boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_member() then
    raise exception 'forbidden: 로그인이 필요합니다' using errcode = '42501';
  end if;
  if p_saved then
    if not exists (select 1 from public.meetups where id = p_meetup_id and status = 'published') then
      raise exception '공개 중인 프로그램만 저장할 수 있어요' using errcode = '22023';
    end if;
    insert into public.saved_meetups (user_id, meetup_id) values (auth.uid(), p_meetup_id) on conflict do nothing;
  else
    delete from public.saved_meetups where user_id = auth.uid() and meetup_id = p_meetup_id;
  end if;
end;
$$;
revoke all on function public.set_meetup_saved(uuid, boolean) from public, anon;
grant execute on function public.set_meetup_saved(uuid, boolean) to authenticated;

-- 내 저장 목록 (제목·다음 일정 함께, 최근 저장 순)
create function public.my_saved_meetups()
returns table (meetup_id uuid, title text, next_starts_at timestamptz, area text, status public.meetup_status, saved_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.title,
         (select min(s.starts_at) from public.meetup_sessions s where s.meetup_id = m.id and s.status <> 'cancelled' and s.starts_at > now()),
         (select s.area from public.meetup_sessions s where s.meetup_id = m.id and s.status <> 'cancelled' and s.starts_at > now() order by s.starts_at limit 1),
         m.status, sm.created_at
  from public.saved_meetups sm join public.meetups m on m.id = sm.meetup_id
  where sm.user_id = auth.uid()
  order by sm.created_at desc
  limit 60
$$;
revoke all on function public.my_saved_meetups() from public, anon;
grant execute on function public.my_saved_meetups() to authenticated;

-- 호스트: 내 프로그램별 저장한 사람 수
create function public.host_meetup_save_counts()
returns table (meetup_id uuid, saves integer)
language sql
stable
security definer
set search_path = ''
as $$
  select sm.meetup_id, count(*)::int
  from public.saved_meetups sm
  join public.meetups m on m.id = sm.meetup_id
  where m.host_id = auth.uid() and private.has_role('host')
  group by sm.meetup_id
$$;
revoke all on function public.host_meetup_save_counts() from public, anon;
grant execute on function public.host_meetup_save_counts() to authenticated;
