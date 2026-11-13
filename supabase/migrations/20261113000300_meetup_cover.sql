-- ============================================================================
-- 프로그램 대표 사진 (호스트가 직접 올림) — 메인 첫 화면·목록·상세에 보임
--  - 저장소 meetup-covers: 누구나 보기, 올리기·바꾸기·지우기는 본인 폴더(회원 id)만
--  - 표에는 저장 위치(cover_path)만. 위치는 반드시 "본인 id/파일명" 형식 (남의 폴더 사진 연결 불가)
--  - 공개 중인 프로그램의 사진을 바꾸면 감사 기록 (운영팀이 확인할 수 있게)
--  - 기존 cover_image_url(외부 주소)은 그대로 두고, 새 사진이 있으면 새 사진을 우선 사용
-- ============================================================================

alter table public.meetups
  add column cover_path text check (cover_path is null or cover_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$');

grant select (cover_path) on public.meetups to anon, authenticated;
grant insert (cover_path) on public.meetups to authenticated;
grant update (cover_path) on public.meetups to authenticated;

-- 본인 폴더 사진만 연결 + 공개 중 변경은 감사 기록
create function private.guard_meetup_cover()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cover_path is not null and split_part(new.cover_path, '/', 1) <> new.host_id::text then
    raise exception '본인이 올린 사진만 쓸 수 있어요' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and new.cover_path is distinct from old.cover_path and old.status = 'published' then
    insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after)
    values (auth.uid(), 'member', 'meetup.cover_change', 'meetup', old.id,
            jsonb_build_object('cover_path', old.cover_path), jsonb_build_object('cover_path', new.cover_path));
  end if;
  return new;
end;
$$;
revoke all on function private.guard_meetup_cover() from public, anon, authenticated;

create trigger guard_meetup_cover
  before insert or update of cover_path on public.meetups
  for each row execute function private.guard_meetup_cover();

-- 저장소 ------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meetup-covers', 'meetup-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy meetup_covers_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'meetup-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy meetup_covers_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'meetup-covers' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'meetup-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy meetup_covers_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'meetup-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy meetup_covers_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'meetup-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
