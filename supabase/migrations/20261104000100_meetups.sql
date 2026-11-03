-- ============================================================================
-- 2단계(일부 선행): 모임 탐색 — 카테고리, 호스트 프로필, 모임, 회차
--  - 공개된(published) 모임과 승인된 호스트만 누구나 조회
--  - 상세 주소(address_detail)는 공개 조회 불가 (확정 참가자 공개는 예약 단계에서)
--  - is_sample = 샘플 데이터 표시 (화면에 "샘플" 표기, 실제 데이터와 구분)
--  - 쓰기(호스트 등록·수정)는 다음 작업에서 정책 추가
-- ============================================================================

create type public.host_status as enum ('applied', 'approved', 'rejected', 'suspended');
create type public.meetup_status as enum ('draft', 'pending_review', 'published', 'rejected', 'archived', 'suspended');
create type public.meetup_type as enum ('general', 'class', 'outdoor', 'alcohol');
create type public.session_status as enum ('open', 'closed', 'cancelled', 'completed');

-- 카테고리 ---------------------------------------------------------------------
create table public.categories (
  slug text primary key check (slug ~ '^[a-z][a-z0-9-]{1,30}$'),
  name text not null,
  description text not null default '',
  sort_order smallint not null default 0,
  is_active boolean not null default true
);

insert into public.categories (slug, name, description, sort_order) values
  ('reading',    '독서',     '한 권의 책으로 시작되는 대화', 10),
  ('music',      '음악',     '함께 듣고, 이야기하는 시간', 20),
  ('photo',      '사진',     '같은 장면을 다르게 보는 법', 30),
  ('art',        '아트·클래스', '손으로 만드는 작은 결과물', 40),
  ('philosophy', '철학·인문', '일상의 질문을 깊게', 50),
  ('networking', '네트워킹', '일과 관심사로 연결되는 사람들', 60),
  ('travel',     '여행',     '떠나기 전과 다녀온 뒤의 이야기', 70),
  ('outdoor',    '아웃도어', '걷고, 달리고, 바깥에서', 80),
  ('wine',       '와인',     '주류 모임은 운영 검토 후 오픈 예정', 90);

-- 호스트 프로필 ------------------------------------------------------------------
create table public.host_profiles (
  user_id uuid primary key references public.profiles (id) on delete restrict,
  display_name text not null check (char_length(display_name) between 2 and 30),
  headline text not null default '' check (char_length(headline) <= 60),
  bio text not null default '' check (char_length(bio) <= 2000),
  expertise text[] not null default '{}',
  instagram_handle text check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  status public.host_status not null default 'applied',
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 모임 ---------------------------------------------------------------------------
create table public.meetups (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.host_profiles (user_id) on delete restrict,
  category_slug text not null references public.categories (slug),
  meetup_type public.meetup_type not null default 'general',
  title text not null check (char_length(title) between 5 and 60),
  summary text not null check (char_length(summary) between 10 and 120),
  description text not null check (char_length(description) between 20 and 5000),
  cover_image_url text check (cover_image_url is null or cover_image_url ~ '^https://'),
  price integer not null check (price >= 0 and price <= 1000000),
  max_quantity_per_booking smallint not null default 1 check (max_quantity_per_booking between 1 and 4),
  target_audience text not null default '' check (char_length(target_audience) <= 500),
  requirements text not null default '' check (char_length(requirements) <= 500),
  what_to_bring text not null default '' check (char_length(what_to_bring) <= 500),
  agenda jsonb not null default '[]' check (jsonb_typeof(agenda) = 'array'),
  refund_policy_text text not null default '' check (char_length(refund_policy_text) <= 1000),
  min_age smallint check (min_age is null or min_age between 14 and 100),
  status public.meetup_status not null default 'draft',
  review_note text,
  is_sample boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 주류 모임은 법률·운영 검토 완료 전까지 공개 불가 (설계안 9-5)
  constraint meetups_alcohol_locked check (not (meetup_type = 'alcohol' and status = 'published'))
);
create index meetups_status_category_idx on public.meetups (status, category_slug);
create index meetups_host_idx on public.meetups (host_id);

-- 회차 ---------------------------------------------------------------------------
create table public.meetup_sessions (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.meetups (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  area text not null check (char_length(area) between 2 and 30),          -- 공개: 동네 이름 (예: 성수동)
  venue_name text not null check (char_length(venue_name) between 2 and 60), -- 공개: 장소 이름
  address_detail text not null default '' check (char_length(address_detail) <= 200), -- 비공개: 상세 주소
  capacity smallint not null check (capacity between 1 and 200),
  reserved_count smallint not null default 0 check (reserved_count >= 0),
  status public.session_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetup_sessions_time_order check (ends_at > starts_at),
  constraint meetup_sessions_capacity check (reserved_count <= capacity)
);
create index meetup_sessions_meetup_idx on public.meetup_sessions (meetup_id, starts_at);
create index meetup_sessions_starts_idx on public.meetup_sessions (starts_at);

create trigger host_profiles_set_updated_at before update on public.host_profiles
  for each row execute function private.set_updated_at();
create trigger meetups_set_updated_at before update on public.meetups
  for each row execute function private.set_updated_at();
create trigger meetup_sessions_set_updated_at before update on public.meetup_sessions
  for each row execute function private.set_updated_at();

-- RLS + 권한 ---------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.host_profiles enable row level security;
alter table public.meetups enable row level security;
alter table public.meetup_sessions enable row level security;

revoke all on public.categories, public.host_profiles, public.meetups, public.meetup_sessions
  from public, anon, authenticated;

grant select on public.categories to anon, authenticated;
create policy categories_select_active on public.categories
  for select to anon, authenticated using (is_active);

grant select (user_id, display_name, headline, bio, expertise, instagram_handle, status, is_sample, created_at)
  on public.host_profiles to anon, authenticated;
create policy host_profiles_select_public on public.host_profiles
  for select to anon, authenticated
  using (status = 'approved' or user_id = (select auth.uid()) or (select private.is_admin()));

grant select (id, host_id, category_slug, meetup_type, title, summary, description, cover_image_url, price,
              max_quantity_per_booking, target_audience, requirements, what_to_bring, agenda,
              refund_policy_text, min_age, status, is_sample, published_at, created_at)
  on public.meetups to anon, authenticated;
create policy meetups_select_published on public.meetups
  for select to anon, authenticated
  using (
    (status = 'published' and exists (
      select 1 from public.host_profiles h where h.user_id = host_id and h.status = 'approved'))
    or host_id = (select auth.uid())
    or (select private.is_admin())
  );

-- 상세 주소(address_detail)는 열 권한에서 제외
grant select (id, meetup_id, starts_at, ends_at, area, venue_name, capacity, reserved_count, status, created_at)
  on public.meetup_sessions to anon, authenticated;
create policy meetup_sessions_select_visible on public.meetup_sessions
  for select to anon, authenticated
  using (exists (select 1 from public.meetups m where m.id = meetup_id));  -- 모임 조회 권한을 그대로 따름
