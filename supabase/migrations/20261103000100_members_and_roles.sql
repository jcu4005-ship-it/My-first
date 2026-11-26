-- ============================================================================
-- 1단계: 회원·권한 기반
--  - 사용자 식별자는 auth.users.id (변경되지 않는 UUID). 닉네임·이메일은 식별자로 쓰지 않는다.
--  - 권한은 user_roles 표에만 저장한다. 회원이 수정할 수 있는 user_metadata는 권한 판단에 쓰지 않는다.
--  - 모든 테이블은 RLS 활성 + 역할별 GRANT를 명시한다(기본 전부 회수).
--  - 감사 기록·동의 기록은 추가만 가능(수정·삭제 불가).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. 기본 권한 정리
-- ----------------------------------------------------------------------------
-- 앞으로 public 스키마에 만드는 함수는 기본적으로 아무도 실행할 수 없게 한다(필요한 것만 개별 허용).
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- 외부 API로 노출되지 않는 내부 스키마 (RLS 도우미·트리거 함수용)
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1. 값 목록(enum)
-- ----------------------------------------------------------------------------
create type public.app_role as enum ('participant', 'host', 'admin');
create type public.member_status as enum ('active', 'suspended', 'withdrawn');
create type public.consent_type as enum ('terms', 'privacy', 'age_14_plus', 'marketing');

-- ----------------------------------------------------------------------------
-- 2. 닉네임 정규화
--    저장값: NFKC 정규화 + 앞뒤 공백 제거 + 연속 공백 1칸
--    중복 검사값: 저장값을 소문자로 바꾸고 공백을 모두 제거
-- ----------------------------------------------------------------------------
create function private.clean_nickname(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(btrim(normalize(coalesce(raw, ''), NFKC)), '[[:space:]]+', ' ', 'g')
$$;

create function private.nickname_key(nickname text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(private.clean_nickname(nickname), '[[:space:]]+', '', 'g'))
$$;

create function private.is_reserved_nickname(key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select key = any (array[
    'admin', 'administrator', 'root', 'system', 'staff', 'support', 'official',
    'operator', 'manager', 'moderator', 'host',
    '관리자', '운영자', '운영팀', '고객센터', '공식', '매니저', '호스트'
  ])
$$;

-- ----------------------------------------------------------------------------
-- 3. 테이블
-- ----------------------------------------------------------------------------

-- 3-1. 공개 프로필 (누구나 볼 수 있는 정보만)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  nickname text not null,
  nickname_key text generated always as (private.nickname_key(nickname)) stored,
  avatar_url text,
  bio text,
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_length check (char_length(nickname) between 2 and 20),
  constraint profiles_nickname_charset check (
    nickname ~ '^[가-힣A-Za-z0-9_.]+( [가-힣A-Za-z0-9_.]+)*$'
  ),
  constraint profiles_nickname_key_length check (char_length(nickname_key) >= 2),
  constraint profiles_nickname_not_reserved check (not private.is_reserved_nickname(nickname_key)),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 300),
  constraint profiles_avatar_url_https check (avatar_url is null or avatar_url ~ '^https://')
);
create unique index profiles_nickname_key_unique on public.profiles (nickname_key);
comment on table public.profiles is '공개 프로필. 개인정보(연락처 등)는 profile_private에 둔다.';

-- 3-2. 비공개 정보 (본인만. 호스트는 어떤 경로로도 접근 불가)
create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete restrict,
  phone text,
  birth_year smallint,
  interests text[] not null default '{}',
  adult_verified_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint profile_private_phone_format check (phone is null or phone ~ '^01[0-9]{8,9}$'),
  constraint profile_private_birth_year_range check (birth_year is null or birth_year between 1900 and 2100),
  constraint profile_private_interests_size check (cardinality(interests) <= 20)
);
comment on table public.profile_private is '비공개 회원 정보. 본인만 조회·수정. adult_verified_at은 본인 수정 불가.';

-- 3-3. 역할 (회원 스스로 추가·수정·삭제 불가)
create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete restrict,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete restrict,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
comment on table public.user_roles is '권한. 변경은 관리자 함수(admin_set_user_role) 또는 최초 관리자 지정 절차로만.';

-- 3-4. 동의 이력 (추가만)
create table public.legal_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete restrict,
  consent_type public.consent_type not null,
  document_version text not null,
  agreed boolean not null,
  created_at timestamptz not null default now()
);
create index legal_consents_user_idx on public.legal_consents (user_id, consent_type, created_at desc);

-- 3-5. 감사 기록 (추가만. 관리자도 수정·삭제 불가)
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,                    -- 행위자 (bootstrap/system이면 null 가능)
  actor_kind text not null check (actor_kind in ('admin', 'system', 'bootstrap')),
  action text not null,
  target_type text,
  target_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id);

-- ----------------------------------------------------------------------------
-- 4. 공통 트리거
-- ----------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.normalize_profile_nickname()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nickname := private.clean_nickname(new.nickname);
  return new;
end;
$$;

create function private.block_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% 기록은 수정하거나 삭제할 수 없습니다', tg_table_name
    using errcode = '42501';
end;
$$;

create trigger profiles_normalize_nickname
  before insert or update of nickname on public.profiles
  for each row execute function private.normalize_profile_nickname();
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger profile_private_set_updated_at
  before update on public.profile_private
  for each row execute function private.set_updated_at();
create trigger legal_consents_append_only
  before update or delete on public.legal_consents
  for each row execute function private.block_mutation();
create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function private.block_mutation();
create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function private.block_mutation();
create trigger legal_consents_no_truncate
  before truncate on public.legal_consents
  for each statement execute function private.block_mutation();

-- ----------------------------------------------------------------------------
-- 5. 권한 확인 함수 (RLS에서 사용, 외부 API 비노출)
-- ----------------------------------------------------------------------------
create function private.current_user_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select auth.uid()
$$;

create function private.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active'
  )
$$;

create function private.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = auth.uid()
      and r.role = p_role
      and p.status = 'active'
  )
$$;

-- 관리자: admin 역할 + 2단계 인증 완료(aal2) 토큰
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('admin')
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

grant execute on function private.current_user_id() to anon, authenticated;
grant execute on function private.is_active_member() to anon, authenticated;
grant execute on function private.has_role(public.app_role) to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.clean_nickname(text) to anon, authenticated;
grant execute on function private.nickname_key(text) to anon, authenticated;
grant execute on function private.is_reserved_nickname(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. 가입 처리 트리거 (auth.users 추가 시)
--    - 닉네임과 필수 동의를 가입 정보에서 읽어 검증한다.
--    - 역할은 항상 participant 하나만 부여한다. 가입 정보에 role 등이 있어도 무시한다.
-- ----------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  consents jsonb := coalesce(meta -> 'consents', '{}'::jsonb);
  v_nickname text := private.clean_nickname(meta ->> 'nickname');
  v_terms text := consents ->> 'terms_version';
  v_privacy text := consents ->> 'privacy_version';
  v_age boolean := coalesce((consents ->> 'age_14_plus')::boolean, false);
  v_marketing boolean := coalesce((consents ->> 'marketing')::boolean, false);
begin
  if v_nickname = '' then
    raise exception 'nickname_required' using errcode = '23514';
  end if;
  if v_terms is null or v_privacy is null or not v_age then
    raise exception 'required_consents_missing' using errcode = '23514';
  end if;

  insert into public.profiles (id, nickname) values (new.id, v_nickname);
  insert into public.profile_private (user_id) values (new.id);
  insert into public.user_roles (user_id, role) values (new.id, 'participant');

  insert into public.legal_consents (user_id, consent_type, document_version, agreed) values
    (new.id, 'terms', v_terms, true),
    (new.id, 'privacy', v_privacy, true),
    (new.id, 'age_14_plus', v_terms, true),
    (new.id, 'marketing', coalesce(consents ->> 'marketing_version', v_terms), v_marketing);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ----------------------------------------------------------------------------
-- 7. RLS + 명시적 GRANT
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.user_roles enable row level security;
alter table public.legal_consents enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.profiles, public.profile_private, public.user_roles,
  public.legal_consents, public.audit_logs from public, anon, authenticated;

-- profiles: 공개 열 조회, 본인은 닉네임·사진·소개만 수정
grant select (id, nickname, avatar_url, bio, status, created_at) on public.profiles to anon, authenticated;
grant update (nickname, avatar_url, bio) on public.profiles to authenticated;

create policy profiles_select_active on public.profiles
  for select to anon, authenticated
  using (status = 'active' or id = (select auth.uid()) or (select private.is_admin()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select private.is_active_member()))
  with check (id = (select auth.uid()));

-- profile_private: 본인만 조회, 연락처·출생연도·관심사만 수정 (관리자도 직접 조회 불가)
grant select (user_id, phone, birth_year, interests, adult_verified_at, updated_at)
  on public.profile_private to authenticated;
grant update (phone, birth_year, interests) on public.profile_private to authenticated;

create policy profile_private_select_own on public.profile_private
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy profile_private_update_own on public.profile_private
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_member()))
  with check (user_id = (select auth.uid()));

-- user_roles: 본인 것 조회, 관리자(aal2)는 전체 조회. 추가·수정·삭제 권한 없음
grant select on public.user_roles to authenticated;

create policy user_roles_select_own_or_admin on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- legal_consents: 본인 것 조회, 관리자 조회. 추가는 가입 트리거로만
grant select on public.legal_consents to authenticated;

create policy legal_consents_select_own_or_admin on public.legal_consents
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- audit_logs: 관리자(aal2)만 조회. 추가는 관리자 함수 내부에서만
grant select on public.audit_logs to authenticated;

create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using ((select private.is_admin()));

-- ----------------------------------------------------------------------------
-- 8. 관리자 함수 (외부에서 호출 가능, 내부에서 관리자+aal2 확인, 모두 감사 기록)
-- ----------------------------------------------------------------------------
create function public.admin_set_user_role(
  p_user_id uuid,
  p_role public.app_role,
  p_grant boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_before text[];
  v_after text[];
  v_admin_count int;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'reason_required: 사유를 5자 이상 입력하세요' using errcode = '22023';
  end if;
  if p_role = 'participant' then
    raise exception 'participant 역할은 변경할 수 없습니다' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;

  -- 동시 변경 시 "마지막 관리자" 판단이 어긋나지 않도록 관리자 행 잠금
  perform 1 from public.user_roles where role = 'admin' for update;

  select coalesce(array_agg(role::text order by role), '{}') into v_before
    from public.user_roles where user_id = p_user_id;

  if p_grant then
    insert into public.user_roles (user_id, role, granted_by)
      values (p_user_id, p_role, v_actor)
      on conflict (user_id, role) do nothing;
  else
    if p_role = 'admin' then
      if p_user_id = v_actor then
        raise exception '자기 자신의 관리자 권한은 회수할 수 없습니다' using errcode = '42501';
      end if;
      select count(*) into v_admin_count from public.user_roles where role = 'admin' and user_id <> p_user_id;
      if v_admin_count = 0 then
        raise exception '마지막 관리자의 권한은 회수할 수 없습니다' using errcode = '42501';
      end if;
    end if;
    delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;

  select coalesce(array_agg(role::text order by role), '{}') into v_after
    from public.user_roles where user_id = p_user_id;

  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after, reason)
  values (
    v_actor, 'admin',
    case when p_grant then 'role.grant' else 'role.revoke' end,
    'member', p_user_id,
    jsonb_build_object('roles', v_before),
    jsonb_build_object('roles', v_after, 'changed_role', p_role),
    btrim(p_reason)
  );
end;
$$;

create function public.admin_set_member_status(
  p_user_id uuid,
  p_status public.member_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_before public.member_status;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'reason_required: 사유를 5자 이상 입력하세요' using errcode = '22023';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception '탈퇴 처리는 별도 절차로만 가능합니다' using errcode = '22023';
  end if;
  if p_user_id = v_actor then
    raise exception '자기 자신의 상태는 변경할 수 없습니다' using errcode = '42501';
  end if;

  select status into v_before from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;

  update public.profiles set status = p_status where id = p_user_id;

  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after, reason)
  values (v_actor, 'admin', 'member.status', 'member', p_user_id,
          jsonb_build_object('status', v_before), jsonb_build_object('status', p_status), btrim(p_reason));
end;
$$;

-- 관리자용 회원 목록 (이메일 포함 = 개인정보 열람 → 호출마다 감사 기록)
create function public.admin_list_members(
  p_search text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  nickname text,
  email text,
  status public.member_status,
  roles text[],
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;

  insert into public.audit_logs (actor_id, actor_kind, action, target_type, after)
  values (auth.uid(), 'admin', 'member.list', 'member',
          jsonb_build_object('search', p_search, 'limit', p_limit, 'offset', p_offset));

  return query
    select p.id, p.nickname, u.email::text, p.status,
           coalesce((select array_agg(r.role::text order by r.role) from public.user_roles r where r.user_id = p.id), '{}'),
           p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where p_search is null or btrim(p_search) = ''
       or position(private.nickname_key(p_search) in p.nickname_key) > 0
       or position(lower(btrim(p_search)) in lower(u.email)) > 0
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 200)
    offset greatest(p_offset, 0);
end;
$$;

-- 닉네임 사용 가능 여부 (가입 화면 사전 확인용. 닉네임은 공개 정보이므로 노출 위험 없음)
create function public.nickname_available(p_nickname text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.nickname_key(p_nickname) <> ''
     and not private.is_reserved_nickname(private.nickname_key(p_nickname))
     and not exists (select 1 from public.profiles where nickname_key = private.nickname_key(p_nickname))
$$;

revoke all on function public.admin_set_user_role(uuid, public.app_role, boolean, text) from public, anon;
revoke all on function public.admin_set_member_status(uuid, public.member_status, text) from public, anon;
revoke all on function public.admin_list_members(text, int, int) from public, anon;
revoke all on function public.nickname_available(text) from public;
grant execute on function public.admin_set_user_role(uuid, public.app_role, boolean, text) to authenticated;
grant execute on function public.admin_set_member_status(uuid, public.member_status, text) to authenticated;
grant execute on function public.admin_list_members(text, int, int) to authenticated;
grant execute on function public.nickname_available(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. 최초 관리자 지정 (일반 가입과 분리된 절차)
--    - private 스키마 + 실행 권한 회수 → 앱/외부 API로는 호출 불가
--    - DB 소유자 권한(Supabase 대시보드 SQL 편집기 또는 CLI)으로만 실행
--    - 관리자가 이미 1명이라도 있으면 거부 → 이후 관리자는 admin_set_user_role(2단계 인증)으로만
--    - 이메일 인증을 마친 회원만 지정 가능, 감사 기록 남김
-- ----------------------------------------------------------------------------
create function private.bootstrap_first_admin(p_email text, p_reason text default '최초 관리자 지정')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('bootstrap_first_admin'));

  if exists (select 1 from public.user_roles where role = 'admin') then
    raise exception '이미 관리자가 있습니다. 추가 관리자는 관리자 화면(2단계 인증)에서 지정하세요.'
      using errcode = '42501';
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower(btrim(p_email))
    and u.email_confirmed_at is not null;
  if v_user_id is null then
    raise exception '이메일 인증을 마친 회원을 찾을 수 없습니다: %', p_email using errcode = 'P0002';
  end if;

  insert into public.user_roles (user_id, role, granted_by) values (v_user_id, 'admin', null);

  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after, reason)
  values (null, 'bootstrap', 'role.grant', 'member', v_user_id,
          null, jsonb_build_object('roles', array['admin'], 'changed_role', 'admin'), p_reason);

  return v_user_id;
end;
$$;

revoke all on function private.bootstrap_first_admin(text, text) from public, anon, authenticated, service_role;
revoke all on function private.handle_new_user() from public, anon, authenticated;
