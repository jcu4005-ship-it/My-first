-- ============================================================================
-- 크리에이터 지원 접수 (발굴 파이프라인 1단계)
--  - 로그인 없이 1분 안에 제출하는 짧은 지원서: 이름·분야·잘하는 것·관련 경험·지원 동기 (+ 연락처·동의)
--  - 기존 host_applications(로그인 후 정식 호스트 신청)와 분리: 이 표는 "발굴·인터뷰" 단계, 협업이 정해지면 정식 신청으로 이어짐
--  - 제출은 DB 함수로만(검증·중복 방지·접수 폭주 제한), 읽기·상태 변경·메모는 관리자(2단계 인증)만
--  - 연락처는 표에서 직접 못 읽게 하고(열 권한), 관리자도 사유를 적어야 원문 열람(감사 기록)
--  - 향후 AI 분석 연결: 지원자 단위로 분리된 인터뷰 메모·녹취록(notes)과 분석·소개 문구·브랜딩 방향·기획안(outputs) 보관 표
-- ============================================================================

create type public.creator_field as enum ('art_culture', 'knowledge', 'professional', 'lifestyle', 'other');
create type public.creator_application_status as enum
  ('new', 'reviewing', 'interview_scheduled', 'interview_done', 'collaborating', 'on_hold', 'rejected');

create table public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  applied_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 30),
  field public.creator_field not null,
  strength text not null check (char_length(strength) between 5 and 1000),
  experience text not null check (char_length(experience) between 5 and 1000),
  motivation text not null check (char_length(motivation) between 5 and 1000),
  contact_phone text not null check (contact_phone ~ '^01[016789][0-9]{7,8}$'),
  link_url text check (link_url is null or (link_url ~ '^https://[^[:space:]]+$' and char_length(link_url) <= 300)),
  wished_activity text check (wished_activity is null or char_length(wished_activity) <= 1000),
  consented_at timestamptz not null,
  applicant_id uuid references public.profiles (id) on delete set null,
  status public.creator_application_status not null default 'new',
  status_changed_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
-- 같은 번호로 진행 중인 지원이 있으면 또 접수하지 않음 (거절된 지원은 다시 지원 가능)
create unique index creator_applications_one_open_per_phone on public.creator_applications (contact_phone)
  where status <> 'rejected';
create index creator_applications_status_idx on public.creator_applications (status, applied_at desc);
create trigger creator_applications_set_updated_at before update on public.creator_applications
  for each row execute function private.set_updated_at();

-- 지원자별 전화 인터뷰 메모·녹취록 (여러 건 가능)
create table public.creator_application_notes (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.creator_applications (id) on delete cascade,
  kind text not null default 'interview_memo' check (kind in ('interview_memo', 'transcript', 'other')),
  body text not null check (char_length(body) between 1 and 20000),
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index creator_application_notes_app_idx on public.creator_application_notes (application_id, created_at);

-- 지원자별 결과물: AI 고유성 분석, 소개 문구, 브랜딩 방향, 프로그램 기획안 (지금은 쓰는 화면 없음 — 구조만 준비)
create table public.creator_application_outputs (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.creator_applications (id) on delete cascade,
  kind text not null check (kind in ('uniqueness_analysis', 'intro_copy', 'branding_direction', 'program_plan')),
  content text not null check (char_length(content) between 1 and 50000),
  source text not null default 'manual' check (source in ('manual', 'ai')),
  model text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index creator_application_outputs_app_idx on public.creator_application_outputs (application_id, kind, created_at desc);

alter table public.creator_applications enable row level security;
alter table public.creator_application_notes enable row level security;
alter table public.creator_application_outputs enable row level security;
revoke all on public.creator_applications, public.creator_application_notes, public.creator_application_outputs from public, anon, authenticated;

-- 읽기: 관리자(2단계 인증)만. 연락처 열은 열 권한에서 제외(원문은 아래 함수로만)
grant select (id, applied_at, name, field, strength, experience, motivation, link_url, wished_activity, consented_at,
              applicant_id, status, status_changed_at, reviewed_by, updated_at)
  on public.creator_applications to authenticated;
grant select on public.creator_application_notes, public.creator_application_outputs to authenticated;
create policy creator_applications_admin_select on public.creator_applications
  for select to authenticated using ((select private.is_admin()));
create policy creator_application_notes_admin_select on public.creator_application_notes
  for select to authenticated using ((select private.is_admin()));
create policy creator_application_outputs_admin_select on public.creator_application_outputs
  for select to authenticated using ((select private.is_admin()));
-- 쓰기 권한 없음 → 아래 함수로만

-- ---------------------------------------------------------------------------
-- 제출 (로그인 없이 가능): 검증·중복 방지·접수 폭주 제한
-- ---------------------------------------------------------------------------
create function public.submit_creator_application(
  p_name text, p_field public.creator_field, p_strength text, p_experience text, p_motivation text,
  p_phone text, p_link text, p_wish text, p_consent boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_strength text := btrim(coalesce(p_strength, ''));
  v_experience text := btrim(coalesce(p_experience, ''));
  v_motivation text := btrim(coalesce(p_motivation, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_wish text := nullif(btrim(coalesce(p_wish, '')), '');
  v_id uuid;
begin
  if not coalesce(p_consent, false) then raise exception '개인정보 수집·이용에 동의해 주세요' using errcode = '22023'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 30 then raise exception '이름 또는 활동명을 2~30자로 입력해 주세요' using errcode = '22023'; end if;
  if p_field is null then raise exception '관심 분야를 선택해 주세요' using errcode = '22023'; end if;
  if char_length(v_strength) < 5 then raise exception '잘하거나 자신 있는 것을 5자 이상 적어 주세요' using errcode = '22023'; end if;
  if char_length(v_experience) < 5 then raise exception '관련 경험을 5자 이상 적어 주세요' using errcode = '22023'; end if;
  if char_length(v_motivation) < 5 then raise exception '함께하고 싶은 이유를 5자 이상 적어 주세요' using errcode = '22023'; end if;
  if v_phone !~ '^01[016789][0-9]{7,8}$' then raise exception '휴대폰 번호 형식을 확인해 주세요 (예: 010-1234-5678)' using errcode = '22023'; end if;
  if v_link is not null and (v_link !~ '^https://[^[:space:]]+$' or char_length(v_link) > 300) then
    raise exception 'https:// 로 시작하는 링크를 입력해 주세요' using errcode = '22023';
  end if;
  if char_length(v_strength) > 1000 or char_length(v_experience) > 1000 or char_length(v_motivation) > 1000 or char_length(coalesce(v_wish, '')) > 1000 then
    raise exception '답변은 항목마다 1000자 이내로 적어 주세요' using errcode = '22023';
  end if;
  -- 접수 폭주(자동 입력) 제한: 한 시간에 100건 넘으면 잠시 막음
  if (select count(*) from public.creator_applications where applied_at > now() - interval '1 hour') >= 100 then
    raise exception '지금은 접수가 몰려 있어요. 잠시 뒤에 다시 시도해 주세요' using errcode = '22023';
  end if;
  if exists (select 1 from public.creator_applications where contact_phone = v_phone and status <> 'rejected') then
    raise exception '이미 접수된 지원이 있어요. 운영팀이 확인한 뒤 연락드릴게요' using errcode = '22023';
  end if;

  insert into public.creator_applications (name, field, strength, experience, motivation, contact_phone, link_url, wished_activity, consented_at, applicant_id)
  values (v_name, p_field, v_strength, v_experience, v_motivation, v_phone, v_link, v_wish, now(), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_creator_application(text, public.creator_field, text, text, text, text, text, text, boolean) from public;
grant execute on function public.submit_creator_application(text, public.creator_field, text, text, text, text, text, text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 관리자: 상태 변경 (감사 기록)
-- ---------------------------------------------------------------------------
create function public.admin_set_creator_application_status(p_id uuid, p_status public.creator_application_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  select id, status into a from public.creator_applications where id = p_id for update;
  if not found then raise exception '지원서를 찾을 수 없습니다' using errcode = 'P0002'; end if;
  if a.status = p_status then return; end if;
  update public.creator_applications
     set status = p_status, status_changed_at = now(), reviewed_by = auth.uid()
   where id = p_id;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after)
  values (auth.uid(), 'admin', 'creator_application.status', 'creator_application', p_id,
          jsonb_build_object('status', a.status), jsonb_build_object('status', p_status));
end;
$$;
revoke all on function public.admin_set_creator_application_status(uuid, public.creator_application_status) from public, anon;
grant execute on function public.admin_set_creator_application_status(uuid, public.creator_application_status) to authenticated;

-- ---------------------------------------------------------------------------
-- 관리자: 인터뷰 메모·녹취록 추가
-- ---------------------------------------------------------------------------
create function public.admin_add_creator_application_note(p_id uuid, p_kind text, p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_note bigint;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  if p_kind not in ('interview_memo', 'transcript', 'other') then raise exception '메모 종류를 확인해 주세요' using errcode = '22023'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 20000 then raise exception '내용을 1~20000자로 적어 주세요' using errcode = '22023'; end if;
  if not exists (select 1 from public.creator_applications where id = p_id) then
    raise exception '지원서를 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  insert into public.creator_application_notes (application_id, kind, body, author_id)
  values (p_id, p_kind, v_body, auth.uid()) returning id into v_note;
  return v_note;
end;
$$;
revoke all on function public.admin_add_creator_application_note(uuid, text, text) from public, anon;
grant execute on function public.admin_add_creator_application_note(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 관리자: 연락처 — 기본은 가림, 사유를 적으면 원문(감사 기록)
-- ---------------------------------------------------------------------------
create function public.admin_creator_application_contact(p_id uuid, p_reveal boolean, p_reason text)
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
  select contact_phone into v_phone from public.creator_applications where id = p_id;
  if not found then raise exception '지원서를 찾을 수 없습니다' using errcode = 'P0002'; end if;
  if not coalesce(p_reveal, false) then return private.mask_phone(v_phone); end if;
  if char_length(coalesce(v_reason, '')) < 5 then raise exception '열람 사유를 5자 이상 입력하세요' using errcode = '22023'; end if;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, after, reason)
  values (auth.uid(), 'admin', 'pii.reveal', 'creator_application', p_id, jsonb_build_object('field', 'contact_phone'), v_reason);
  return v_phone;
end;
$$;
revoke all on function public.admin_creator_application_contact(uuid, boolean, text) from public, anon;
grant execute on function public.admin_creator_application_contact(uuid, boolean, text) to authenticated;
