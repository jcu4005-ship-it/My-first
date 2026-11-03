-- ============================================================================
-- 서비스 방향: 전문가가 소수 정예로 가르치는 "클래스" 중심
--  - 카테고리: 친목형(독서·네트워킹·여행·아웃도어·철학·와인)은 비활성(기존 데이터 보존), 클래스형 추가
--  - 호스트 신청: 경력(필수)·자격/수상·포트폴리오·수업 경험 → 관리자 심사 근거, 공개 프로필에 표시
--  - 클래스 정보: 난이도, 수업 후 할 수 있는 것, 재료·도구 제공 안내
--  - 비활성 카테고리로는 새 클래스를 만들거나 옮길 수 없음 (DB가 보장)
-- ============================================================================

-- 1. 카테고리 -------------------------------------------------------------------
update public.categories set is_active = false
 where slug in ('reading', 'philosophy', 'networking', 'travel', 'outdoor', 'wine');

update public.categories set name = '사진·영상', description = '장비보다 보는 눈을 먼저 배우는 수업', sort_order = 10 where slug = 'photo';
update public.categories set name = '드로잉·공예', description = '손으로 완성해 가져가는 결과물', sort_order = 20 where slug = 'art';
update public.categories set name = '악기·보컬', description = '처음 소리를 내는 순간부터', sort_order = 30 where slug = 'music';

insert into public.categories (slug, name, description, sort_order) values
  ('coffee',   '커피·티·향', '감각을 기르는 테이스팅과 블렌딩', 40),
  ('cooking',  '요리·베이킹', '집에서 다시 만들 수 있는 레시피', 50),
  ('writing',  '글쓰기',     '읽히는 문장을 쓰는 연습', 60),
  ('career',   '커리어·실무', '내일 회사에서 바로 쓰는 기술', 70),
  ('wellness', '자세·운동',  '전문가에게 배우는 바른 몸 습관', 80)
on conflict (slug) do update set name = excluded.name, description = excluded.description,
  sort_order = excluded.sort_order, is_active = true;

-- 2. 호스트 전문성 ----------------------------------------------------------------
alter table public.host_profiles
  add column career text not null default '' check (char_length(career) <= 1000),
  add column credentials text not null default '' check (char_length(credentials) <= 500),
  add column portfolio_url text check (portfolio_url is null or (portfolio_url ~ '^https://' and char_length(portfolio_url) <= 300)),
  add column teaching_experience text not null default '' check (char_length(teaching_experience) <= 500);

grant select (career, credentials, portfolio_url, teaching_experience) on public.host_profiles to anon, authenticated;
grant update (career, credentials, portfolio_url, teaching_experience) on public.host_profiles to authenticated;

drop function public.apply_host(text, text, text, text[], text);

create function public.apply_host(
  p_display_name text,
  p_headline text,
  p_bio text,
  p_expertise text[],
  p_instagram text,
  p_career text,
  p_credentials text,
  p_portfolio_url text,
  p_teaching_experience text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_status public.host_status;
  v_career text := btrim(coalesce(p_career, ''));
  v_portfolio text := nullif(btrim(coalesce(p_portfolio_url, '')), '');
begin
  if v_user is null or not private.is_active_member() then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if char_length(v_career) < 20 then
    raise exception '가르칠 분야의 경력을 20자 이상 적어 주세요' using errcode = '22023';
  end if;
  select status into v_status from public.host_profiles where user_id = v_user for update;
  if found then
    if v_status in ('applied', 'approved') then
      raise exception '이미 신청했거나 승인된 호스트입니다' using errcode = '22023';
    elsif v_status = 'suspended' then
      raise exception '이용이 제한된 호스트 계정입니다. 운영팀에 문의해 주세요' using errcode = '42501';
    end if;
    update public.host_profiles
       set display_name = btrim(p_display_name), headline = btrim(coalesce(p_headline, '')),
           bio = btrim(coalesce(p_bio, '')), expertise = coalesce(p_expertise, '{}'),
           instagram_handle = nullif(btrim(coalesce(p_instagram, '')), ''),
           career = v_career, credentials = btrim(coalesce(p_credentials, '')), portfolio_url = v_portfolio,
           teaching_experience = btrim(coalesce(p_teaching_experience, '')),
           status = 'applied', review_note = null, applied_at = now(), reviewed_at = null, reviewed_by = null
     where user_id = v_user;
  else
    insert into public.host_profiles (user_id, display_name, headline, bio, expertise, instagram_handle,
                                      career, credentials, portfolio_url, teaching_experience, status)
    values (v_user, btrim(p_display_name), btrim(coalesce(p_headline, '')), btrim(coalesce(p_bio, '')),
            coalesce(p_expertise, '{}'), nullif(btrim(coalesce(p_instagram, '')), ''),
            v_career, btrim(coalesce(p_credentials, '')), v_portfolio,
            btrim(coalesce(p_teaching_experience, '')), 'applied');
  end if;
end;
$$;
revoke all on function public.apply_host(text, text, text, text[], text, text, text, text, text) from public, anon;
grant execute on function public.apply_host(text, text, text, text[], text, text, text, text, text) to authenticated;

-- 3. 클래스 정보 ------------------------------------------------------------------
create type public.class_level as enum ('all', 'beginner', 'intermediate', 'advanced');

alter table public.meetups
  add column level public.class_level not null default 'all',
  add column learning_outcomes text not null default '' check (char_length(learning_outcomes) <= 500),
  add column materials_note text not null default '' check (char_length(materials_note) <= 300);

alter table public.meetups alter column meetup_type set default 'class';

grant select (level, learning_outcomes, materials_note) on public.meetups to anon, authenticated;
grant insert (level, learning_outcomes, materials_note) on public.meetups to authenticated;
grant update (level, learning_outcomes, materials_note) on public.meetups to authenticated;

-- 4. 비활성 카테고리 보호 ----------------------------------------------------------
create function private.guard_meetup_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.category_slug is distinct from old.category_slug)
     and not exists (select 1 from public.categories where slug = new.category_slug and is_active) then
    raise exception '지금은 열 수 없는 카테고리입니다' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger meetups_guard_category before insert or update of category_slug on public.meetups
  for each row execute function private.guard_meetup_category();
revoke all on function private.guard_meetup_category() from public, anon, authenticated;

-- 5. 탈퇴 시 새 호스트 전문성 정보도 지움 (기존 함수와 동일, 지우는 항목만 추가)
create or replace function public.withdraw_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  r record;
begin
  if v_user is null or not exists (select 1 from public.profiles where id = v_user and status <> 'withdrawn') then
    raise exception '로그인이 필요합니다' using errcode = '42501', hint = 'login_required';
  end if;
  if exists (select 1 from public.user_roles where user_id = v_user and role = 'admin')
     and (select count(*) from public.user_roles where role = 'admin') = 1 then
    raise exception '마지막 관리자는 탈퇴할 수 없습니다' using errcode = 'P0001', hint = 'last_admin';
  end if;
  if exists (select 1 from public.bookings b join public.payments p on p.booking_id = b.id
              join public.meetup_sessions s on s.id = b.session_id
             where b.user_id = v_user and b.status = 'confirmed' and p.status = 'paid' and s.starts_at > now()) then
    raise exception '결제한 예정 모임의 환불이 먼저 필요합니다' using errcode = 'P0001', hint = 'refund_required';
  end if;
  if exists (select 1 from public.bookings b join public.meetup_sessions s on s.id = b.session_id
              join public.meetups m on m.id = s.meetup_id
             where m.host_id = v_user and b.status in ('confirmed', 'pending_payment') and s.starts_at > now()) then
    raise exception '참가자가 있는 내 모임 일정을 먼저 취소해 주세요' using errcode = 'P0001', hint = 'host_active';
  end if;

  -- 내 예정 신청(무료·결제 대기) 취소, 자리 반환
  for r in select b.id, b.session_id, b.quantity from public.bookings b
            join public.meetup_sessions s on s.id = b.session_id
           where b.user_id = v_user and b.status in ('confirmed', 'pending_payment') and s.starts_at > now()
           for update of b loop
    update public.bookings set status = 'cancelled_by_user', cancelled_at = now() where id = r.id;
    update public.meetup_sessions set reserved_count = reserved_count - r.quantity where id = r.session_id;
    update public.payments set status = 'cancelled' where booking_id = r.id and status = 'ready';
  end loop;

  -- 호스트: 모임 비공개, 프로필 익명화
  update public.meetups set status = 'archived'
   where host_id = v_user and status in ('draft', 'pending_review', 'published', 'rejected');
  update public.meetup_sessions set status = 'cancelled'
   where meetup_id in (select id from public.meetups where host_id = v_user) and status in ('open', 'closed') and starts_at > now();
  update public.host_profiles
     set display_name = '탈퇴한 호스트', headline = '', bio = '', expertise = '{}', instagram_handle = null,
         career = '', credentials = '', portfolio_url = null, teaching_experience = '', status = 'suspended'
   where user_id = v_user;

  -- 개인정보 삭제·익명화
  update public.profiles
     set nickname = '탈퇴회원 ' || substr(replace(v_user::text, '-', ''), 1, 10), bio = null, avatar_url = null, status = 'withdrawn'
   where id = v_user;
  update public.profile_private
     set phone = null, birth_year = null, interests = '{}', adult_verified_at = null
   where user_id = v_user;
  delete from public.user_roles where user_id = v_user and role in ('host', 'admin');
  delete from public.notifications where user_id = v_user;

  -- 로그인 정보 삭제·차단 (이메일 익명화로 같은 이메일 재가입 가능)
  update auth.users
     set email = 'withdrawn+' || replace(v_user::text, '-', '') || '@deleted.invalid',
         phone = null, raw_user_meta_data = '{}'::jsonb, encrypted_password = '',
         banned_until = 'infinity'::timestamptz
   where id = v_user;
  delete from auth.identities where user_id = v_user;
  delete from auth.mfa_factors where user_id = v_user;
  delete from auth.sessions where user_id = v_user;

  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, reason)
  values (v_user, 'system', 'member.withdraw', 'member', v_user, '본인 탈퇴');
end;
$$;
