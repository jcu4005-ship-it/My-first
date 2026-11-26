-- ============================================================================
-- 개인정보 이중 보호
--  1) 관리자 화면에서 이메일·휴대폰은 기본 가림(마스킹). 원문은 "사유를 적고 열람"할 때만,
--     열람할 때마다 감사 기록(pii.reveal) — 권한(관리자 2단계 인증) + 기록, 두 겹
--  2) 지원서 휴대폰 번호는 표에서 직접 읽을 수 없음(열 권한 제거). 본인은 본인 함수로, 관리자는 열람 함수로만
--  3) 보관 기간 정리: 반려·미제출 지원서의 개인정보를 1년 뒤 지움 (관리자 실행, 감사 기록)
--  감사 기록은 이미 수정·삭제 불가(append-only)
-- ============================================================================

-- 가림 처리 ------------------------------------------------------------------
create function private.mask_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then p_email
    else left(split_part(p_email, '@', 1), 1) || '***@' || split_part(p_email, '@', 2)
  end
$$;

create function private.mask_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_phone is null or p_phone = '' then p_phone
    else left(regexp_replace(p_phone, '[^0-9]', '', 'g'), 3) || '-****-' || right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 4)
  end
$$;
revoke all on function private.mask_email(text) from public, anon, authenticated;
revoke all on function private.mask_phone(text) from public, anon, authenticated;

-- 1) 회원 목록: 이메일은 가려서. 검색은 전체 이메일로 가능 -------------------------
create or replace function public.admin_list_members(
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
    select p.id, p.nickname, private.mask_email(u.email::text), p.status,
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

-- 관리자: 회원 이메일 원문 열람 (사유 필수, 감사 기록)
create function public.admin_reveal_member_email(p_user_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  if char_length(coalesce(v_reason, '')) < 5 then
    raise exception '열람 사유를 5자 이상 입력하세요' using errcode = '22023';
  end if;
  select email::text into v_email from auth.users where id = p_user_id;
  if not found then
    raise exception '회원을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, after, reason)
  values (auth.uid(), 'admin', 'pii.reveal', 'member', p_user_id, jsonb_build_object('field', 'email'), v_reason);
  return v_email;
end;
$$;
revoke all on function public.admin_reveal_member_email(uuid, text) from public, anon;
grant execute on function public.admin_reveal_member_email(uuid, text) to authenticated;

-- 2) 지원서 휴대폰: 표에서 직접 읽기 차단 -------------------------------------------
revoke select on public.host_applications from authenticated;
grant select (id, applicant_id, status, display_name, pillar, fields, headline, bio, career, credentials, portfolio_url,
              teaching_experience, instagram_handle, program_proposal, value_to_participants, preferred_format,
              consented_at, review_note, reviewed_by, reviewed_at, invited_by, submitted_at, created_at, updated_at)
  on public.host_applications to authenticated;

-- 본인: 내 가장 최근 지원서의 휴대폰 번호 (작성 화면 채우기용)
create function public.my_application_contact()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select contact_phone from public.host_applications
   where applicant_id = auth.uid()
   order by created_at desc
   limit 1
$$;
revoke all on function public.my_application_contact() from public, anon;
grant execute on function public.my_application_contact() to authenticated;

-- 관리자: 지원서 휴대폰 — 기본은 가림, 사유를 적으면 원문(감사 기록)
create function public.admin_application_contact(p_id uuid, p_reveal boolean, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  select contact_phone into v_phone from public.host_applications where id = p_id;
  if not found then
    raise exception '지원서를 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if not coalesce(p_reveal, false) then
    return private.mask_phone(v_phone);
  end if;
  if char_length(coalesce(v_reason, '')) < 5 then
    raise exception '열람 사유를 5자 이상 입력하세요' using errcode = '22023';
  end if;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, after, reason)
  values (auth.uid(), 'admin', 'pii.reveal', 'host_application', p_id, jsonb_build_object('field', 'contact_phone'), v_reason);
  return v_phone;
end;
$$;
revoke all on function public.admin_application_contact(uuid, boolean, text) from public, anon;
grant execute on function public.admin_application_contact(uuid, boolean, text) to authenticated;

-- 3) 보관 기간 정리 -------------------------------------------------------------
-- 대상: 반려되고 1년이 지난 지원서, 마지막 수정 뒤 1년간 제출하지 않은 작성 중 지원서
-- 승인된 지원서는 호스트 계약 관계가 이어지므로 대상이 아님 (탈퇴 시 별도로 지움)
create function private.stale_application_ids()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select id from public.host_applications
   where contact_phone <> ''
     and ((status = 'rejected' and coalesce(reviewed_at, updated_at) < now() - interval '1 year')
       or (status = 'draft' and updated_at < now() - interval '1 year'))
$$;
revoke all on function private.stale_application_ids() from public, anon, authenticated;

create function public.admin_count_stale_pii()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  return (select count(*)::int from private.stale_application_ids());
end;
$$;
revoke all on function public.admin_count_stale_pii() from public, anon;
grant execute on function public.admin_count_stale_pii() to authenticated;

create function public.admin_purge_stale_pii()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  update public.host_applications set
    contact_phone = '', bio = '', career = '', credentials = '', portfolio_url = null, teaching_experience = '',
    instagram_handle = null, program_proposal = '', value_to_participants = '', preferred_format = ''
  where id in (select private.stale_application_ids());
  get diagnostics v_count = row_count;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, after)
  values (auth.uid(), 'admin', 'pii.purge', 'host_application', jsonb_build_object('count', v_count, 'rule', '반려·미제출 1년 경과'));
  return v_count;
end;
$$;
revoke all on function public.admin_purge_stale_pii() from public, anon;
grant execute on function public.admin_purge_stale_pii() to authenticated;
