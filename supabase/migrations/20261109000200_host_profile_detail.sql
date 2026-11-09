-- ============================================================================
-- 호스트 생태계 2단계: 호스트 상세 프로필 + 프로필 사진 저장소
--  - slug: /hosts/[slug] 주소. 승인 시 자동 생성(영문·숫자·하이픈), 호스트가 직접 바꿀 수 없음
--  - occupation(직업·전문 분야 한 줄), philosophy(작업 철학), avatar_path(사진 저장 위치)
--  - 사진 저장소 host-avatars: 누구나 보기, 본인 폴더(사용자 id)에만 올리기·바꾸기·지우기,
--    5MB 이하 jpg/png/webp
-- ============================================================================

alter table public.host_profiles
  add column slug text unique check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$'),
  add column occupation text not null default '' check (char_length(occupation) <= 60),
  add column philosophy text not null default '' check (char_length(philosophy) <= 1000),
  add column avatar_path text check (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$');

grant select (slug, occupation, philosophy, avatar_path) on public.host_profiles to anon, authenticated;
-- 본인 수정 가능한 열: 기존(이름·소개·전문 분야·인스타·경력 등) + 직업·작업 철학·사진. slug·상태·추천은 불가
grant update (occupation, philosophy, avatar_path) on public.host_profiles to authenticated;

-- 사진 경로는 반드시 본인 폴더
create function private.guard_host_avatar_path()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.avatar_path is not null and new.avatar_path is distinct from old.avatar_path
     and split_part(new.avatar_path, '/', 1) <> new.user_id::text then
    raise exception '본인 폴더의 사진만 사용할 수 있습니다' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_host_avatar_path() from public, anon, authenticated;
create trigger host_profiles_guard_avatar before update of avatar_path on public.host_profiles
  for each row execute function private.guard_host_avatar_path();

-- slug 자동 생성: 승인된 호스트에 slug가 없으면 'host-' + 무작위 8자리
create function private.ensure_host_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_slug text;
begin
  if new.status = 'approved' and new.slug is null then
    loop
      v_slug := 'host-' || substr(md5(gen_random_uuid()::text), 1, 8);
      exit when not exists (select 1 from public.host_profiles where slug = v_slug);
    end loop;
    new.slug := v_slug;
  end if;
  return new;
end;
$$;
revoke all on function private.ensure_host_slug() from public, anon, authenticated;
create trigger host_profiles_ensure_slug before insert or update of status on public.host_profiles
  for each row execute function private.ensure_host_slug();

-- 이미 승인된 호스트에게 slug 부여
update public.host_profiles set status = status where status = 'approved' and slug is null;

-- 관리자: slug 변경 (예: 영문 이름으로 정리), 감사 기록
create function public.admin_set_host_slug(p_user_id uuid, p_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$' then
    raise exception '주소는 영문 소문자·숫자·하이픈 3~42자로 입력하세요' using errcode = '22023';
  end if;
  select slug into v_old from public.host_profiles where user_id = p_user_id for update;
  if not found then
    raise exception '호스트를 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.host_profiles where slug = p_slug and user_id <> p_user_id) then
    raise exception '이미 사용 중인 주소입니다' using errcode = '22023';
  end if;
  update public.host_profiles set slug = p_slug where user_id = p_user_id;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after)
  values (auth.uid(), 'admin', 'host.slug_update', 'host', p_user_id, jsonb_build_object('slug', v_old), jsonb_build_object('slug', p_slug));
end;
$$;
revoke all on function public.admin_set_host_slug(uuid, text) from public, anon;
grant execute on function public.admin_set_host_slug(uuid, text) to authenticated;

-- 탈퇴: 작업 철학·직업·사진 경로도 비움 (사진 파일은 운영 정리 대상)
create or replace function private.clear_host_profile_detail_on_suspend()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.display_name = '탈퇴한 호스트' and new.status = 'suspended' then
    new.occupation := '';
    new.philosophy := '';
    new.avatar_path := null;
    new.is_featured := false;
    new.featured_order := null;
  end if;
  return new;
end;
$$;
revoke all on function private.clear_host_profile_detail_on_suspend() from public, anon, authenticated;
create trigger host_profiles_clear_on_withdraw before update on public.host_profiles
  for each row execute function private.clear_host_profile_detail_on_suspend();

-- ---------------------------------------------------------------------------
-- 사진 저장소 (Supabase Storage)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('host-avatars', 'host-avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy host_avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'host-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy host_avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'host-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'host-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy host_avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'host-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy host_avatars_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'host-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- 공개 버킷이라 사진 보기(공개 주소)는 정책 없이 가능. 목록 조회는 본인 폴더만.
