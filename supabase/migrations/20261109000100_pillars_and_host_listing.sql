-- ============================================================================
-- 호스트 생태계 1단계: 3대 분류(Knowledge / Creators / Experts) + 호스트 목록 정보
--  - 세부 분야(categories) 하나가 3대 분류 하나에 속한다 → 프로그램의 대분류는 분야로 자동 결정 (중복 저장 없음)
--  - Knowledge 분야 다시 열기/추가: 철학·인문, 독서·문학, 심리, 경제·사회, 사고법
--  - 호스트: 대표 분류(primary_pillar), 운영팀 추천(is_featured, featured_order)
--    추천은 팔로워 수와 무관하게 관리자만 지정 (DB 함수, 감사 기록)
-- ============================================================================

create type public.pillar as enum ('knowledge', 'creators', 'experts');

-- 1. 분야 → 대분류 ---------------------------------------------------------------
alter table public.categories add column pillar public.pillar;

update public.categories set pillar = 'creators' where slug in ('photo', 'art', 'music', 'writing', 'coffee', 'cooking', 'wine');
update public.categories set pillar = 'experts'  where slug in ('career', 'wellness', 'networking', 'outdoor');
update public.categories set pillar = 'knowledge' where slug in ('reading', 'philosophy', 'travel');

-- Knowledge 분야: 비활성이던 철학·독서를 프로그램(배우는) 형식으로 다시 열고, 새 분야 추가
update public.categories set is_active = true, name = '철학·인문', description = '오래된 질문으로 오늘을 다시 생각하기', sort_order = 1
 where slug = 'philosophy';
update public.categories set is_active = true, name = '독서·문학', description = '깊이 읽고, 나의 말로 정리하기', sort_order = 2
 where slug = 'reading';
insert into public.categories (slug, name, description, sort_order, pillar) values
  ('psychology', '심리',     '나와 타인을 이해하는 언어', 3, 'knowledge'),
  ('society',    '경제·사회', '세상이 움직이는 방식을 읽는 눈', 4, 'knowledge'),
  ('thinking',   '사고법',   '생각을 정리하고 결정하는 도구', 5, 'knowledge')
on conflict (slug) do update set pillar = excluded.pillar, is_active = true;

update public.categories set pillar = 'creators' where pillar is null; -- 혹시 남은 분야가 있으면 기본값
alter table public.categories alter column pillar set not null;
create index categories_pillar_idx on public.categories (pillar, sort_order);
-- categories 는 이미 anon·authenticated 전체 조회 권한 (새 열 포함)

-- 2. 호스트 목록 정보 -------------------------------------------------------------
alter table public.host_profiles
  add column primary_pillar public.pillar,
  add column is_featured boolean not null default false,
  add column featured_order smallint check (featured_order is null or featured_order between 1 and 99);

grant select (primary_pillar, is_featured, featured_order) on public.host_profiles to anon, authenticated;
-- 수정 권한(update)은 주지 않는다: 관리자 함수로만 변경
create index host_profiles_listing_idx on public.host_profiles (status, primary_pillar);

-- 3. 관리자: 호스트 목록 정보 변경 (대표 분류·추천) -----------------------------------
create function public.admin_update_host_listing(
  p_user_id uuid,
  p_primary_pillar public.pillar,
  p_is_featured boolean,
  p_featured_order smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h record;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  select user_id, status, primary_pillar, is_featured, featured_order into h
    from public.host_profiles where user_id = p_user_id for update;
  if not found then
    raise exception '호스트를 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if coalesce(p_is_featured, false) and h.status <> 'approved' then
    raise exception '승인된 호스트만 추천할 수 있습니다' using errcode = '22023';
  end if;

  update public.host_profiles
     set primary_pillar = p_primary_pillar,
         is_featured = coalesce(p_is_featured, false),
         featured_order = case when coalesce(p_is_featured, false) then p_featured_order else null end
   where user_id = p_user_id;

  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after)
  values (auth.uid(), 'admin', 'host.listing_update', 'host', p_user_id,
          jsonb_build_object('primary_pillar', h.primary_pillar, 'is_featured', h.is_featured, 'featured_order', h.featured_order),
          jsonb_build_object('primary_pillar', p_primary_pillar, 'is_featured', coalesce(p_is_featured, false),
                             'featured_order', case when coalesce(p_is_featured, false) then p_featured_order end));
end;
$$;
revoke all on function public.admin_update_host_listing(uuid, public.pillar, boolean, smallint) from public, anon;
grant execute on function public.admin_update_host_listing(uuid, public.pillar, boolean, smallint) to authenticated;
