-- ============================================================================
-- 호스트 지원서 개편: 이력서형 → 짧은 이야기형 (필수 질문 3개)
--  - 새 항목: passion(시간 가는 줄 모르고 하는 일), often_asked(주변에서 자주 묻거나 부탁하는 것)
--  - 제출 필수: 이름(2자+), 휴대폰, passion(10자+), often_asked(10자+), 만들고 싶은 모임(20자+), 동의
--  - 지원 분류·한 줄 소개·자기소개·경력·가치는 더 이상 필수가 아님 (기존 열은 그대로 두어 옛 지원서 보존)
--  - 저장 함수에 새 항목을 마지막 인자(기본값 '')로 추가 → 기존 호출도 그대로 동작
-- ============================================================================

alter table public.host_applications
  add column passion text not null default '' check (char_length(passion) <= 1000),
  add column often_asked text not null default '' check (char_length(often_asked) <= 1000);

grant select (passion, often_asked) on public.host_applications to authenticated;

-- ---------------------------------------------------------------------------
-- 임시 저장: 기존 15개 인자 + 새 항목 2개 (함수 모양이 바뀌므로 예전 것은 지움)
-- ---------------------------------------------------------------------------
drop function public.save_host_application(text, text, public.pillar, text[], text, text, text, text, text, text, text, text, text, text, boolean);

create function public.save_host_application(
  p_display_name text, p_contact_phone text, p_pillar public.pillar, p_fields text[],
  p_headline text, p_bio text, p_career text, p_credentials text, p_portfolio_url text,
  p_teaching_experience text, p_instagram text, p_program_proposal text,
  p_value_to_participants text, p_preferred_format text, p_consent boolean,
  p_passion text default '', p_often_asked text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  a record;
  v_id uuid;
begin
  if v_user is null or not private.is_active_member() then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if exists (select 1 from public.host_profiles where user_id = v_user and status in ('approved', 'suspended')) then
    raise exception '이미 호스트이거나 이용이 제한된 계정입니다' using errcode = '22023';
  end if;
  select id, status into a from public.host_applications
   where applicant_id = v_user and status in ('draft', 'submitted', 'reviewing', 'revision_requested') for update;
  if found and a.status not in ('draft', 'revision_requested') then
    raise exception '제출한 지원서는 심사 중에는 고칠 수 없습니다' using errcode = '22023';
  end if;

  if not found then
    insert into public.host_applications (applicant_id) values (v_user) returning id into v_id;
  else
    v_id := a.id;
  end if;

  update public.host_applications set
    display_name = btrim(coalesce(p_display_name, '')),
    contact_phone = btrim(coalesce(p_contact_phone, '')),
    pillar = p_pillar,
    fields = coalesce(p_fields, '{}'),
    headline = btrim(coalesce(p_headline, '')),
    bio = btrim(coalesce(p_bio, '')),
    career = btrim(coalesce(p_career, '')),
    credentials = btrim(coalesce(p_credentials, '')),
    portfolio_url = nullif(btrim(coalesce(p_portfolio_url, '')), ''),
    teaching_experience = btrim(coalesce(p_teaching_experience, '')),
    instagram_handle = nullif(btrim(coalesce(p_instagram, '')), ''),
    program_proposal = btrim(coalesce(p_program_proposal, '')),
    value_to_participants = btrim(coalesce(p_value_to_participants, '')),
    preferred_format = btrim(coalesce(p_preferred_format, '')),
    passion = btrim(coalesce(p_passion, '')),
    often_asked = btrim(coalesce(p_often_asked, '')),
    consented_at = case when coalesce(p_consent, false) then coalesce(consented_at, now()) else null end
  where id = v_id;
  return v_id;
end;
$$;

revoke all on function public.save_host_application(text, text, public.pillar, text[], text, text, text, text, text, text, text, text, text, text, boolean, text, text) from public, anon;
grant execute on function public.save_host_application(text, text, public.pillar, text[], text, text, text, text, text, text, text, text, text, text, boolean, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 제출: 새 필수 항목 검사
-- ---------------------------------------------------------------------------
create or replace function public.submit_host_application()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  a public.host_applications;
begin
  if v_user is null or not private.is_active_member() then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  select * into a from public.host_applications
   where applicant_id = v_user and status in ('draft', 'revision_requested') for update;
  if not found then
    raise exception '제출할 지원서가 없습니다' using errcode = 'P0002';
  end if;
  if char_length(a.display_name) < 2 then raise exception '활동 이름을 2자 이상 입력하세요' using errcode = '22023'; end if;
  if a.contact_phone = '' then raise exception '연락받을 휴대폰 번호를 입력하세요' using errcode = '22023'; end if;
  if char_length(a.passion) < 10 then raise exception '시간 가는 줄 모르고 하는 일을 10자 이상 적어 주세요' using errcode = '22023'; end if;
  if char_length(a.often_asked) < 10 then raise exception '주변에서 자주 묻거나 부탁하는 것을 10자 이상 적어 주세요' using errcode = '22023'; end if;
  if char_length(a.program_proposal) < 20 then raise exception '만들고 싶은 모임을 20자 이상 적어 주세요' using errcode = '22023'; end if;
  if a.consented_at is null then raise exception '개인정보·제출 자료 이용에 동의해 주세요' using errcode = '22023'; end if;

  update public.host_applications set status = 'submitted', submitted_at = now() where id = a.id;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after)
  values (v_user, 'member', 'host_application.submit', 'host_application', a.id,
          jsonb_build_object('status', a.status), jsonb_build_object('status', 'submitted'));
end;
$$;

-- ---------------------------------------------------------------------------
-- 보관 기간 정리·회원 탈퇴 시 새 항목도 함께 비움 (탈퇴 정리는 팔로우·콘텐츠 내리기까지 이전 정의를 모두 유지)
-- ---------------------------------------------------------------------------
create or replace function public.admin_purge_stale_pii()
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
    instagram_handle = null, program_proposal = '', value_to_participants = '', preferred_format = '',
    passion = '', often_asked = ''
  where id in (select private.stale_application_ids());
  get diagnostics v_count = row_count;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, after)
  values (auth.uid(), 'admin', 'pii.purge', 'host_application', jsonb_build_object('count', v_count, 'rule', '반려·미제출 1년 경과'));
  return v_count;
end;
$$;

create or replace function private.on_member_withdrawn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'withdrawn' and old.status is distinct from 'withdrawn' then
    update public.host_applications set
      display_name = '', contact_phone = '', headline = '', bio = '', career = '', credentials = '',
      portfolio_url = null, teaching_experience = '', instagram_handle = null, program_proposal = '',
      value_to_participants = '', preferred_format = '', fields = '{}', passion = '', often_asked = '',
      status = case when status in ('draft', 'submitted', 'reviewing', 'revision_requested') then 'rejected'::public.application_status else status end,
      review_note = case when status in ('draft', 'submitted', 'reviewing', 'revision_requested') then '회원 탈퇴' else review_note end
    where applicant_id = new.id;
    delete from public.host_follows where follower_id = new.id or host_id = new.id;
    update public.contents set status = 'archived', review_note = '회원 탈퇴', cover_path = null
     where (author_id = new.id or host_id = new.id) and status <> 'archived';
  end if;
  return new;
end;
$$;
revoke all on function private.on_member_withdrawn() from public, anon, authenticated;
