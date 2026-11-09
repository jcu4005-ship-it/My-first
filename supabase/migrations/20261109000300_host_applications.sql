-- ============================================================================
-- 호스트 생태계 3단계: 호스트 지원서 분리 (host_applications)
--  - 지원서(비공개)와 공개 호스트 프로필(host_profiles)을 분리. 승인되는 순간 공개 프로필 생성·갱신
--  - 상태: draft → submitted → reviewing → revision_requested → approved / rejected
--  - 한 회원당 진행 중(draft·submitted·reviewing·revision_requested) 지원서 1개 (반려 후 새 지원 가능, 이력 보존)
--  - 쓰기는 모두 DB 함수로만: 지원자 저장·제출 / 관리자 심사(메모 필수 상황 강제) + 감사 기록 + 알림
--  - 휴대폰 번호는 본인·관리자만 (공개 권한 없음), 탈퇴 시 지원서 개인정보 삭제
--  - 예전 apply_host 경로는 닫음(실행 권한 회수), 심사 대기 중이던 예전 신청은 새 지원서로 이전
-- ============================================================================

-- 감사 기록에 '회원 본인' 행위자 종류 추가 (지원서 제출 기록용)
alter table public.audit_logs drop constraint audit_logs_actor_kind_check;
alter table public.audit_logs add constraint audit_logs_actor_kind_check
  check (actor_kind in ('admin', 'system', 'bootstrap', 'member'));

create type public.application_status as enum ('draft', 'submitted', 'reviewing', 'revision_requested', 'approved', 'rejected');

create table public.host_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles (id) on delete restrict,
  status public.application_status not null default 'draft',
  display_name text not null default '' check (char_length(display_name) <= 30),
  contact_phone text not null default '' check (contact_phone = '' or contact_phone ~ '^01[016789]-?[0-9]{3,4}-?[0-9]{4}$'),
  pillar public.pillar,
  fields text[] not null default '{}' check (cardinality(fields) <= 8),
  headline text not null default '' check (char_length(headline) <= 60),
  bio text not null default '' check (char_length(bio) <= 2000),
  career text not null default '' check (char_length(career) <= 1000),
  credentials text not null default '' check (char_length(credentials) <= 500),
  portfolio_url text check (portfolio_url is null or (portfolio_url ~ '^https://' and char_length(portfolio_url) <= 300)),
  teaching_experience text not null default '' check (char_length(teaching_experience) <= 500),
  instagram_handle text check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  program_proposal text not null default '' check (char_length(program_proposal) <= 3000),
  value_to_participants text not null default '' check (char_length(value_to_participants) <= 1000),
  preferred_format text not null default '' check (char_length(preferred_format) <= 500),
  consented_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  invited_by uuid references public.profiles (id),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index host_applications_one_open on public.host_applications (applicant_id)
  where status in ('draft', 'submitted', 'reviewing', 'revision_requested');
create index host_applications_status_idx on public.host_applications (status, submitted_at desc);
create trigger host_applications_set_updated_at before update on public.host_applications
  for each row execute function private.set_updated_at();

alter table public.host_applications enable row level security;
revoke all on public.host_applications from public, anon, authenticated;
grant select on public.host_applications to authenticated;
create policy host_applications_select_own_or_admin on public.host_applications
  for select to authenticated
  using (applicant_id = (select auth.uid()) or (select private.is_admin()));
-- insert/update/delete 권한 없음 → 아래 함수로만

-- ---------------------------------------------------------------------------
-- 지원자: 임시 저장 (진행 중 지원서가 없으면 새로 만들고, draft·revision_requested 일 때만 수정)
-- ---------------------------------------------------------------------------
create function public.save_host_application(
  p_display_name text, p_contact_phone text, p_pillar public.pillar, p_fields text[],
  p_headline text, p_bio text, p_career text, p_credentials text, p_portfolio_url text,
  p_teaching_experience text, p_instagram text, p_program_proposal text,
  p_value_to_participants text, p_preferred_format text, p_consent boolean
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
    consented_at = case when coalesce(p_consent, false) then coalesce(consented_at, now()) else null end
  where id = v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 지원자: 제출 (필수 항목 검사)
-- ---------------------------------------------------------------------------
create function public.submit_host_application()
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
  if char_length(a.display_name) < 2 then raise exception '호스트 이름을 2자 이상 입력하세요' using errcode = '22023'; end if;
  if a.contact_phone = '' then raise exception '연락받을 휴대폰 번호를 입력하세요' using errcode = '22023'; end if;
  if a.pillar is null then raise exception '지원 분류를 선택하세요' using errcode = '22023'; end if;
  if char_length(a.headline) < 5 then raise exception '한 줄 소개를 5자 이상 입력하세요' using errcode = '22023'; end if;
  if char_length(a.bio) < 20 then raise exception '자기소개를 20자 이상 입력하세요' using errcode = '22023'; end if;
  if char_length(a.career) < 20 then raise exception '가르칠 분야의 경력을 20자 이상 적어 주세요' using errcode = '22023'; end if;
  if char_length(a.program_proposal) < 30 then raise exception '프로그램 기획안을 30자 이상 적어 주세요' using errcode = '22023'; end if;
  if char_length(a.value_to_participants) < 10 then raise exception '참가자에게 줄 가치를 10자 이상 적어 주세요' using errcode = '22023'; end if;
  if a.consented_at is null then raise exception '개인정보·제출 자료 이용에 동의해 주세요' using errcode = '22023'; end if;

  update public.host_applications set status = 'submitted', submitted_at = now() where id = a.id;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after)
  values (v_user, 'member', 'host_application.submit', 'host_application', a.id,
          jsonb_build_object('status', a.status), jsonb_build_object('status', 'submitted'));
end;
$$;

-- ---------------------------------------------------------------------------
-- 관리자: 심사 (start_review / request_revision / approve / reject)
-- ---------------------------------------------------------------------------
create function public.admin_review_host_application(p_id uuid, p_action text, p_note text)
returns public.application_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.host_applications;
  v_next public.application_status;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_prev_status public.host_status;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  select * into a from public.host_applications where id = p_id for update;
  if not found then
    raise exception '지원서를 찾을 수 없습니다' using errcode = 'P0002';
  end if;

  if p_action = 'start_review' and a.status = 'submitted' then
    v_next := 'reviewing';
  elsif p_action = 'request_revision' and a.status in ('submitted', 'reviewing') then
    if v_note is null or char_length(v_note) < 5 then
      raise exception '수정 요청 내용을 5자 이상 입력하세요' using errcode = '22023';
    end if;
    v_next := 'revision_requested';
  elsif p_action = 'reject' and a.status in ('submitted', 'reviewing') then
    if v_note is null or char_length(v_note) < 5 then
      raise exception '반려 사유를 5자 이상 입력하세요' using errcode = '22023';
    end if;
    v_next := 'rejected';
  elsif p_action = 'approve' and a.status in ('submitted', 'reviewing') then
    v_next := 'approved';
  else
    raise exception '지금 상태(%)에서는 할 수 없는 작업입니다', a.status using errcode = '22023';
  end if;

  update public.host_applications
     set status = v_next, review_note = coalesce(v_note, review_note), reviewed_by = auth.uid(), reviewed_at = now()
   where id = a.id;

  if v_next = 'approved' then
    select status into v_prev_status from public.host_profiles where user_id = a.applicant_id for update;
    if found then
      update public.host_profiles set
        display_name = a.display_name, headline = a.headline, bio = a.bio, expertise = a.fields,
        instagram_handle = a.instagram_handle, career = a.career, credentials = a.credentials,
        portfolio_url = a.portfolio_url, teaching_experience = a.teaching_experience,
        primary_pillar = coalesce(primary_pillar, a.pillar),
        status = 'approved', review_note = null, reviewed_at = now(), reviewed_by = auth.uid()
      where user_id = a.applicant_id; -- 상태가 바뀌면 기존 트리거가 승인 알림을 보냄
      if v_prev_status = 'approved' then
        perform private.notify(a.applicant_id, 'host.approved', '호스트 신청이 승인되었어요', '이제 프로그램을 만들 수 있어요.', '/host');
      end if;
    else
      insert into public.host_profiles (user_id, display_name, headline, bio, expertise, instagram_handle,
                                        career, credentials, portfolio_url, teaching_experience, primary_pillar,
                                        status, reviewed_at, reviewed_by)
      values (a.applicant_id, a.display_name, a.headline, a.bio, a.fields, a.instagram_handle,
              a.career, a.credentials, a.portfolio_url, a.teaching_experience, a.pillar,
              'approved', now(), auth.uid());
      perform private.notify(a.applicant_id, 'host.approved', '호스트 신청이 승인되었어요', '이제 프로그램을 만들 수 있어요.', '/host');
    end if;
    insert into public.user_roles (user_id, role, granted_by) values (a.applicant_id, 'host', auth.uid())
      on conflict (user_id, role) do nothing;
  elsif v_next = 'revision_requested' then
    perform private.notify(a.applicant_id, 'host.revision_requested', '호스트 지원서 수정 요청이 있어요', v_note, '/become-a-host/apply');
  elsif v_next = 'rejected' then
    perform private.notify(a.applicant_id, 'host.rejected', '호스트 지원이 반려되었어요', v_note, '/become-a-host/apply');
  end if;

  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after, reason)
  values (auth.uid(), 'admin', 'host_application.' || p_action, 'host_application', a.id,
          jsonb_build_object('status', a.status), jsonb_build_object('status', v_next), v_note);
  return v_next;
end;
$$;

revoke all on function public.save_host_application(text, text, public.pillar, text[], text, text, text, text, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.save_host_application(text, text, public.pillar, text[], text, text, text, text, text, text, text, text, text, text, boolean) to authenticated;
revoke all on function public.submit_host_application() from public, anon;
grant execute on function public.submit_host_application() to authenticated;
revoke all on function public.admin_review_host_application(uuid, text, text) from public, anon;
grant execute on function public.admin_review_host_application(uuid, text, text) to authenticated;

-- 예전 신청 경로 닫기 (함수는 남기되 실행 권한 회수)
revoke execute on function public.apply_host(text, text, text, text[], text, text, text, text, text) from authenticated;
revoke execute on function public.admin_review_host(uuid, boolean, text) from authenticated;

-- 반려 알림 링크를 새 지원 주소로
create or replace function private.notify_host_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      perform private.notify(new.user_id, 'host.approved', '호스트 신청이 승인되었어요', '이제 프로그램을 만들 수 있어요.', '/host');
    elsif new.status = 'rejected' then
      perform private.notify(new.user_id, 'host.rejected', '호스트 신청이 반려되었어요', coalesce(new.review_note, ''), '/become-a-host/apply');
    end if;
  end if;
  return new;
end;
$$;

-- 심사 대기 중이던 예전 신청 → 새 지원서(제출 상태)로 이전 (휴대폰 번호·기획안은 비어 있음: 관리자가 수정 요청 가능)
insert into public.host_applications (applicant_id, status, display_name, fields, headline, bio, career, credentials,
                                      portfolio_url, teaching_experience, instagram_handle, submitted_at, created_at)
select user_id, 'submitted', display_name, expertise, headline, bio, career, credentials,
       portfolio_url, teaching_experience, instagram_handle, applied_at, applied_at
  from public.host_profiles
 where status = 'applied' and not is_sample
   and not exists (select 1 from public.host_applications h where h.applicant_id = host_profiles.user_id);

-- ---------------------------------------------------------------------------
-- 탈퇴 시 정리 (회원 상태가 withdrawn 이 되면): 지원서 개인정보 삭제, 진행 중 지원서 반려 처리
-- (4·5단계의 팔로우·콘텐츠 정리도 이 함수에 추가)
-- ---------------------------------------------------------------------------
create function private.on_member_withdrawn()
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
      value_to_participants = '', preferred_format = '', fields = '{}',
      status = case when status in ('draft', 'submitted', 'reviewing', 'revision_requested') then 'rejected'::public.application_status else status end,
      review_note = case when status in ('draft', 'submitted', 'reviewing', 'revision_requested') then '회원 탈퇴' else review_note end
    where applicant_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.on_member_withdrawn() from public, anon, authenticated;
create trigger profiles_on_withdrawn after update of status on public.profiles
  for each row execute function private.on_member_withdrawn();
