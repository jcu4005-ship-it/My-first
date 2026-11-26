-- ============================================================================
-- 비공개 베타 운영 장치
--  1) 서비스 설정(app_settings, 한 줄): 초대제 가입(invite_only), 유료 신청 허용(paid_bookings_enabled)
--     - 기본값은 "안전한 쪽": 초대제 켬, 유료 신청 막음 → 운영 DB는 만들자마자 비공개 베타 상태
--     - 로컬·스테이징은 seed.sql / 스테이징 배포가 시험용 값(초대제 끔, 유료 허용)으로 바꿈
--  2) 초대 코드(invite_codes): 관리자만 발급·조회. 가입 시 DB가 직접 검사하고 사용 횟수를 올림
--  3) 유료 신청 막기: 신청 행이 만들어질 때 DB가 검사 (화면·서버 검사와 별개로 한 번 더)
--  변경은 모두 관리자(2단계 인증) 함수로만, 감사 기록을 남김
-- ============================================================================

-- 1) 서비스 설정 ---------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),
  invite_only boolean not null default true,
  paid_bookings_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.app_settings default values;

revoke all on public.app_settings from anon, authenticated;
alter table public.app_settings enable row level security;
create policy app_settings_read on public.app_settings for select using (true);
grant select (invite_only, paid_bookings_enabled) on public.app_settings to anon, authenticated;

create function private.setting_invite_only()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select invite_only from public.app_settings where id), true)
$$;
create function private.setting_paid_bookings()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select paid_bookings_enabled from public.app_settings where id), false)
$$;
revoke all on function private.setting_invite_only() from public, anon, authenticated;
revoke all on function private.setting_paid_bookings() from public, anon, authenticated;

create function public.admin_set_app_settings(p_invite_only boolean, p_paid_bookings boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  if p_invite_only is null or p_paid_bookings is null then
    raise exception '설정 값이 비어 있습니다' using errcode = '22023';
  end if;
  if char_length(coalesce(v_reason, '')) < 5 then
    raise exception '변경 사유를 5자 이상 입력하세요' using errcode = '22023';
  end if;
  select jsonb_build_object('invite_only', invite_only, 'paid_bookings_enabled', paid_bookings_enabled)
    into v_before from public.app_settings where id;
  update public.app_settings
     set invite_only = p_invite_only, paid_bookings_enabled = p_paid_bookings, updated_at = now(), updated_by = auth.uid()
   where id;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, before, after, reason)
  values (auth.uid(), 'admin', 'settings.update', 'app_settings', v_before,
          jsonb_build_object('invite_only', p_invite_only, 'paid_bookings_enabled', p_paid_bookings), v_reason);
end;
$$;
revoke all on function public.admin_set_app_settings(boolean, boolean, text) from public, anon;
grant execute on function public.admin_set_app_settings(boolean, boolean, text) to authenticated;

-- 2) 초대 코드 ------------------------------------------------------------------
create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{3,18}[A-Z0-9]$'),
  note text not null default '' check (char_length(note) <= 100),
  max_uses integer not null check (max_uses between 1 and 1000),
  used_count integer not null default 0 check (used_count >= 0 and used_count <= max_uses),
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
revoke all on public.invite_codes from anon, authenticated;
alter table public.invite_codes enable row level security;
create policy invite_codes_admin_read on public.invite_codes for select to authenticated using (private.is_admin());
grant select on public.invite_codes to authenticated;

-- 가입 화면용: 코드가 지금 쓸 수 있는지(참/거짓)만 알려 줌. 코드 목록·사용 수는 드러나지 않음
create function public.invite_code_valid(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invite_codes
     where code = upper(btrim(coalesce(p_code, '')))
       and is_active and used_count < max_uses
       and (expires_at is null or expires_at > now())
  )
$$;
revoke all on function public.invite_code_valid(text) from public;
grant execute on function public.invite_code_valid(text) to anon, authenticated;

create function public.admin_create_invite_code(p_code text, p_note text, p_max_uses integer, p_expires_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  if v_code !~ '^[A-Z0-9][A-Z0-9-]{3,18}[A-Z0-9]$' then
    raise exception '코드는 영문 대문자·숫자·하이픈 5~20자로 입력하세요' using errcode = '22023';
  end if;
  if p_max_uses is null or p_max_uses < 1 or p_max_uses > 1000 then
    raise exception '사용 가능 횟수는 1~1000회로 입력하세요' using errcode = '22023';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception '만료일은 지금보다 뒤여야 합니다' using errcode = '22023';
  end if;
  if exists (select 1 from public.invite_codes where code = v_code) then
    raise exception '이미 있는 코드입니다' using errcode = '22023';
  end if;
  insert into public.invite_codes (code, note, max_uses, expires_at, created_by)
  values (v_code, left(btrim(coalesce(p_note, '')), 100), p_max_uses, p_expires_at, auth.uid())
  returning id into v_id;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, after)
  values (auth.uid(), 'admin', 'invite.create', 'invite_code', v_id,
          jsonb_build_object('code', v_code, 'max_uses', p_max_uses, 'expires_at', p_expires_at));
  return v_id;
end;
$$;
revoke all on function public.admin_create_invite_code(text, text, integer, timestamptz) from public, anon;
grant execute on function public.admin_create_invite_code(text, text, integer, timestamptz) to authenticated;

create function public.admin_set_invite_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  update public.invite_codes set is_active = coalesce(p_active, false) where id = p_id;
  if not found then
    raise exception '초대 코드를 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, after)
  values (auth.uid(), 'admin', case when p_active then 'invite.activate' else 'invite.deactivate' end, 'invite_code', p_id, '{}'::jsonb);
end;
$$;
revoke all on function public.admin_set_invite_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_invite_active(uuid, boolean) to authenticated;

-- 가입 시 초대 코드 검사 (초대제가 켜져 있을 때만). 가입 정보의 invite_code를 읽고 사용 횟수를 올림
-- 같은 트랜잭션이라 가입이 실패하면 사용 횟수도 되돌아감
create function private.check_invite_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
begin
  if not private.setting_invite_only() then
    return new;
  end if;
  update public.invite_codes
     set used_count = used_count + 1
   where code = v_code and is_active and used_count < max_uses
     and (expires_at is null or expires_at > now());
  if not found then
    raise exception 'invite_required' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.check_invite_on_signup() from public, anon, authenticated;

create trigger check_invite_before_signup
  before insert on auth.users
  for each row execute function private.check_invite_on_signup();

-- 3) 유료 신청 막기 -------------------------------------------------------------
create function private.guard_paid_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.unit_price > 0 and not private.setting_paid_bookings() then
    raise exception '지금은 비공개 베타 기간이라 무료 프로그램만 신청할 수 있어요' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_paid_booking() from public, anon, authenticated;

create trigger guard_paid_booking
  before insert on public.bookings
  for each row execute function private.guard_paid_booking();
