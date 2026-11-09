-- ============================================================================
-- 샘플 데이터 (로컬·CI, 그리고 승인된 스테이징 실행에서 seed_samples=yes일 때만). 운영 DB에는 넣지 않습니다.
-- 모든 행은 is_sample = true 이며 화면에 "샘플"로 표시됩니다.
-- 샘플 호스트 계정은 로그인할 수 없도록 임의 비밀번호로 생성됩니다.
-- 다시 실행해도 됩니다: 샘플 호스트는 갱신하고, 샘플 클래스·일정만 지우고 다시 넣습니다.
-- (샘플 클래스는 신청할 수 없으므로 신청·결제 기록이 없습니다. 있으면 외래키 때문에 실패하고 아무것도 바뀌지 않습니다.)
-- ============================================================================

do $$
declare
  h1 uuid := 'a0000000-0000-4000-8000-000000000001';
  h2 uuid := 'a0000000-0000-4000-8000-000000000002';
  h3 uuid := 'a0000000-0000-4000-8000-000000000003';
  h4 uuid := 'a0000000-0000-4000-8000-000000000004';
  h5 uuid := 'a0000000-0000-4000-8000-000000000005';
  base timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  m uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
         extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}',
         jsonb_build_object('nickname', nick, 'consents',
           jsonb_build_object('terms_version','sample','privacy_version','sample','age_14_plus',true)),
         now(), now()
  from (values
    (h1, 'host-reading@sample.invalid', '필름로그 도현'),
    (h2, 'host-photo@sample.invalid',   '드로잉 스튜디오 오후'),
    (h3, 'host-music@sample.invalid',   '기타 선생 민재'),
    (h4, 'host-salon@sample.invalid',   '실무 코치 지훈'),
    (h5, 'host-think@sample.invalid',   '생각 연구소 윤재')
  ) as t(id, email, nick)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (h1,'host'),(h2,'host'),(h3,'host'),(h4,'host'),(h5,'host')
    on conflict (user_id, role) do nothing;

  insert into public.host_profiles (user_id, display_name, headline, bio, expertise, instagram_handle,
                                    career, credentials, portfolio_url, teaching_experience, status, is_sample,
                                    primary_pillar, is_featured, featured_order,
                                    slug, occupation, philosophy)
  values
  (h1, '필름로그 도현', '필름 현상소를 운영하는 10년 차 사진가',
   '상업 사진 스튜디오에서 7년간 일했고, 지금은 을지로에서 필름 현상소를 운영합니다. 비싼 장비보다 천천히 바라보는 눈이 중요하다고 믿어요.',
   array['필름 사진','노출','현상'], 'filmlog.dh',
   '상업 사진 스튜디오 포토그래퍼 7년, 필름 현상소 운영 3년. 브랜드 룩북·매거진 촬영 다수.',
   '서울 사진 공모전 입선(샘플)', 'https://example.com/filmlog', '필름 입문 클래스 누적 120회 진행', 'approved', true, 'creators', true, 1,
   'filmlog-dohyun', '사진가 · 필름 현상소 운영', '셔터를 누르기 전에 한 번 더 보는 습관이 사진을 바꾼다고 믿습니다. 장비보다 눈을 먼저 가르칩니다.'),
  (h2, '드로잉 스튜디오 오후', '그림 초보도 완성작을 들고 가는 드로잉·공예 공방',
   '시각디자인을 전공하고 일러스트레이터로 일하다 익선동에 작은 공방을 열었습니다. "못 그린다"는 분들이 한 장을 완성하는 순간을 가장 좋아해요.',
   array['어반 스케치','수채화','가죽 공예'], null,
   '일러스트레이터 8년, 공방 운영 4년. 출판·광고 일러스트 작업.',
   '가죽공예 지도사 자격(샘플)', 'https://example.com/ohu-studio', '원데이 클래스 누적 300회, 기업 출강 20회', 'approved', true, 'creators', false, null,
   'ohu-studio', '일러스트레이터 · 공방 운영', '잘 그리는 것보다 끝까지 그려 보는 경험이 먼저입니다. 모두가 한 장을 완성해 돌아가게 합니다.'),
  (h3, '기타 선생 민재', '첫 코드부터 한 곡 완주까지, 통기타 입문 전문',
   '실용음악과를 졸업하고 세션 기타리스트로 활동했습니다. 손가락이 아프지 않게 시작하는 법부터 차근차근 알려 드려요.',
   array['통기타','코드 반주','핑거스타일'], null,
   '세션 기타리스트 9년, 실용음악 학원 강사 5년.',
   '실용음악과 졸업(샘플)', null, '성인 입문반 강의 5년', 'approved', true, 'creators', false, null,
   'minjae-guitar', '세션 기타리스트 · 입문 강사', '손가락이 아프지 않게 시작하는 것, 그리고 첫 곡을 끝까지 쳐 보는 것. 그 두 가지면 충분합니다.'),
  (h4, '실무 코치 지훈', '내일 회사에서 바로 쓰는 엑셀·보고서·발표',
   '대기업 전략기획팀에서 12년간 보고서와 데이터를 다뤘습니다. 이론보다 실제 회사 파일로 연습합니다.',
   array['엑셀','보고서 작성','프레젠테이션'], null,
   '대기업 전략기획팀 12년, 사내 엑셀·보고서 강사 6년.',
   'MOS Excel Expert(샘플)', 'https://example.com/jihoon', '기업 교육 150회, 직장인 소규모 클래스 80회', 'approved', true, 'experts', true, 2,
   'jihoon-coach', '전략기획 12년 · 실무 교육 강사', '이론보다 내일 회사에서 바로 쓰는 한 가지를 가져가게 하는 것이 좋은 수업이라고 생각합니다.'),
  (h5, '생각 연구소 윤재', '철학으로 생각을 정리하는 법을 가르칩니다',
   '대학에서 철학을 가르치다 직장인을 위한 사고법 워크숍을 열고 있습니다. 어려운 철학자 이름보다 내 생각을 또렷하게 만드는 질문을 함께 다룹니다.',
   array['철학','사고법','글로 생각 정리'], null,
   '대학 철학과 강사 8년, 기업 사고력 워크숍 진행 4년.',
   '철학 박사(샘플)', 'https://example.com/think-lab', '성인 대상 인문 강좌 200회', 'approved', true, 'knowledge', true, 3,
   'think-lab-yunjae', '철학 강사 · 사고법 워크숍', '철학은 정답을 외우는 학문이 아니라 좋은 질문을 만드는 연습입니다.')
  on conflict (user_id) do update set
    display_name = excluded.display_name, headline = excluded.headline, bio = excluded.bio,
    expertise = excluded.expertise, instagram_handle = excluded.instagram_handle, career = excluded.career,
    credentials = excluded.credentials, portfolio_url = excluded.portfolio_url,
    teaching_experience = excluded.teaching_experience, status = 'approved', is_sample = true,
    primary_pillar = excluded.primary_pillar, is_featured = excluded.is_featured, featured_order = excluded.featured_order,
    slug = excluded.slug, occupation = excluded.occupation, philosophy = excluded.philosophy;

  -- 이전 샘플 클래스·일정 정리 (샘플만)
  delete from public.meetup_sessions where meetup_id in (select id from public.meetups where is_sample);
  delete from public.meetups where is_sample;

  -- 1. 사진·영상
  insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
    level, learning_outcomes, materials_note,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h1, 'photo', 'outdoor', '필름 카메라 입문 클래스 — 서촌 출사와 노출 기초',
    '노출의 원리를 배우고, 필름 한 롤로 서촌 골목을 직접 찍어 봐요. 카메라는 무료 대여.',
    E'필름 카메라를 처음 잡는 분을 위한 2시간 30분 클래스입니다.\n\n처음 40분은 조리개·셔터·감도가 사진을 어떻게 바꾸는지 실제 카메라로 익히고, 이후 서촌 골목에서 한 롤(36장)을 직접 찍습니다. 촬영 중 강사가 한 분씩 노출과 구도를 봐 드려요.\n\n촬영한 필름은 현상소에서 현상·스캔해 일주일 안에 보내 드립니다.',
    45000, 2, 'beginner',
    E'조리개·셔터·감도를 이해하고 스스로 노출을 맞출 수 있어요.\n필름 한 롤을 끝까지 찍고 현상 결과로 내 사진을 돌아볼 수 있어요.',
    '필름 1롤, 현상·스캔비, 카메라 대여 포함',
    '필름 사진을 처음 시작하는 분, 휴대폰 사진에서 한 단계 나아가고 싶은 분',
    '2시간 정도 걸을 수 있는 체력', '편한 신발, (있다면) 필름 카메라',
    '[{"time":"10:00","title":"카메라 구조와 노출 기초"},{"time":"10:40","title":"서촌 골목 출사 (개별 코칭)"},{"time":"12:00","title":"촬영 돌아보기와 현상 안내"}]',
    '클래스 2일 전까지 전액 환불. 필름·현상비가 포함되어 있습니다. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '6 days 10 hours', base + interval '6 days 12 hours 30 minutes', '서촌', '필름로그 현상소', '서울 종로구 (샘플 주소)', 6, 5);

  -- 2. 드로잉·공예: 어반 스케치
  insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
    level, learning_outcomes, materials_note,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h2, 'art', 'class', '그림 초보를 위한 어반 스케치 원데이 클래스',
    '펜 선 긋기부터 수채 채색까지, 한옥 골목 한 장면을 완성해 가져가요.',
    E'"그림은 못 그려요"라고 말하는 분들을 위한 클래스입니다.\n\n처음 30분은 선 긋기와 원근의 기본을 연습하고, 익선동 한옥 골목에서 한 장면을 골라 그립니다. 강사가 한 분씩 구도를 잡아 드리고, 마지막 30분은 수채 채색으로 완성합니다.',
    48000, 2, 'beginner',
    E'원근의 기본 규칙으로 건물과 골목을 그릴 수 있어요.\n펜 드로잉 위에 수채로 가볍게 채색해 한 장을 완성할 수 있어요.',
    '스케치북, 드로잉 펜, 휴대용 수채 팔레트 제공 (가져가실 수 있어요)',
    '그림을 배워 본 적 없는 분, 여행지에서 그림을 남기고 싶은 분',
    '', '없음 (재료 제공)',
    '[{"time":"14:00","title":"선 긋기·원근 기초"},{"time":"14:30","title":"골목 스케치 (개별 코칭)"},{"time":"15:40","title":"수채 채색"},{"time":"16:10","title":"작품 돌아보기"}]',
    '재료 준비로 인해 클래스 4일 전까지만 전액 환불됩니다. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '12 days 14 hours', base + interval '12 days 16 hours 30 minutes', '익선동', '드로잉 스튜디오 오후', '서울 종로구 (샘플 주소)', 8, 2);

  -- 3. 드로잉·공예: 가죽
  insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
    level, learning_outcomes, materials_note,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h2, 'art', 'class', '손바느질로 만드는 가죽 카드지갑',
    '재단부터 새들 스티치까지, 3시간 만에 평생 쓸 카드지갑을 직접 만들어요.',
    E'이탈리아 베지터블 가죽으로 카드지갑을 만드는 공예 클래스입니다.\n\n가죽 고르기, 재단, 구멍 뚫기, 새들 스티치, 마감까지 전 과정을 직접 합니다. 4명 이하 소수로 진행해 손이 느린 분도 충분히 따라올 수 있어요.',
    68000, 1, 'beginner',
    E'새들 스티치로 튼튼하게 바느질할 수 있어요.\n가죽 재단과 마감의 기본을 익혀 다른 소품도 혼자 도전할 수 있어요.',
    '가죽·실·도구 모두 제공, 완성품 지참',
    '손으로 무언가를 끝까지 만들어 보고 싶은 분, 선물을 직접 만들고 싶은 분',
    '', '없음',
    '[{"time":"13:00","title":"가죽 고르기와 재단"},{"time":"13:50","title":"치즐로 구멍 내기"},{"time":"14:30","title":"새들 스티치"},{"time":"15:40","title":"엣지 마감과 각인"}]',
    '재료 준비로 인해 클래스 5일 전까지만 전액 환불됩니다. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '9 days 13 hours', base + interval '9 days 16 hours', '익선동', '드로잉 스튜디오 오후', '서울 종로구 (샘플 주소)', 4, 1);

  -- 4. 악기·보컬
  insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
    level, learning_outcomes, materials_note,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h3, 'music', 'class', '통기타 첫 코드 클래스 — 2시간 만에 한 곡 반주',
    '기타를 처음 잡아도 괜찮아요. 코드 4개로 익숙한 노래 한 곡을 끝까지 쳐 봅니다.',
    E'기타를 사 놓고 몇 번 못 친 분, 처음 시작하는 분을 위한 입문 클래스입니다.\n\n손가락이 덜 아픈 자세, 코드 4개(C·G·Am·F), 기본 스트로크를 배운 뒤 모두 함께 한 곡을 반주합니다. 6명 이하로 진행해 한 분씩 손 모양을 봐 드려요.',
    39000, 2, 'beginner',
    E'C·G·Am·F 코드를 잡고 바꿀 수 있어요.\n기본 스트로크로 익숙한 노래 한 곡을 처음부터 끝까지 반주할 수 있어요.',
    '연습용 기타 대여 가능 (신청 시 요청), 코드 악보 제공',
    '기타를 처음 배우는 분, 독학하다 멈춘 분',
    '', '(있다면) 본인 기타',
    '[{"time":"19:30","title":"자세와 조율"},{"time":"19:50","title":"코드 4개 익히기"},{"time":"20:40","title":"스트로크 패턴"},{"time":"21:00","title":"한 곡 함께 반주"}]',
    '클래스 3일 전까지 전액 환불. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '3 days 19 hours 30 minutes', base + interval '3 days 21 hours 30 minutes', '합정동', '민재 기타 스튜디오', '서울 마포구 (샘플 주소)', 6, 6),
    (m, base + interval '10 days 19 hours 30 minutes', base + interval '10 days 21 hours 30 minutes', '합정동', '민재 기타 스튜디오', '서울 마포구 (샘플 주소)', 6, 2);

  -- 5. 커리어·실무: 엑셀
  insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
    level, learning_outcomes, materials_note,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h4, 'career', 'class', '직장인 엑셀 실무 — 피벗 테이블과 XLOOKUP',
    '매주 하던 집계 작업을 10분으로 줄이는 실무 엑셀. 실제 회사 데이터 형식으로 연습해요.',
    E'함수 이름은 아는데 막상 업무에선 손이 안 가는 분들을 위한 3시간 실무 클래스입니다.\n\n매출·재고 같은 실제 업무 형식의 예제 파일로 피벗 테이블, XLOOKUP, 조건부 서식을 익히고, 마지막에는 각자 업무 파일 하나를 골라 함께 개선합니다.',
    55000, 1, 'intermediate',
    E'피벗 테이블로 월별·담당자별 집계 표를 직접 만들 수 있어요.\nXLOOKUP으로 다른 시트의 데이터를 정확하게 불러올 수 있어요.',
    '예제 파일 제공. 엑셀이 설치된 노트북 필요',
    'SUM·IF 정도는 써 본 직장인, 반복 집계 업무가 많은 분',
    '엑셀 기본 사용 경험', '엑셀이 설치된 노트북, 충전기',
    '[{"time":"10:00","title":"데이터 정리 원칙"},{"time":"10:30","title":"피벗 테이블 실습"},{"time":"11:30","title":"XLOOKUP과 조건부 서식"},{"time":"12:20","title":"내 업무 파일 개선"}]',
    '클래스 2일 전까지 전액 환불. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '4 days 10 hours', base + interval '4 days 13 hours', '강남역', '스터디룸 포커스', '서울 강남구 (샘플 주소)', 10, 7);

  -- 6. 글쓰기
  insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
    level, learning_outcomes, materials_note,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h4, 'writing', 'class', '한 장으로 끝내는 보고서 글쓰기',
    '결론부터 쓰는 구조, 숫자로 말하는 문장. 내 보고서를 직접 고쳐 보는 첨삭 클래스.',
    E'"그래서 결론이 뭐야?"라는 말을 듣지 않는 보고서를 쓰는 법을 배웁니다.\n\n좋은 보고서와 아쉬운 보고서를 나란히 비교한 뒤, 각자 가져온 보고서 한 장을 구조부터 다시 씁니다. 강사가 모든 분의 결과물을 현장에서 첨삭해 드려요.',
    45000, 1, 'all',
    E'결론-근거-다음 행동 순서로 한 장짜리 보고서를 구성할 수 있어요.\n모호한 표현을 숫자와 사실로 바꿔 쓸 수 있어요.',
    '첨삭 양식 제공',
    '보고서를 자주 쓰는 직장인, 사회초년생',
    '', '최근에 쓴 보고서 1부 (민감 정보는 지워 주세요), 노트북',
    '[{"time":"19:30","title":"좋은 보고서의 구조"},{"time":"20:00","title":"내 보고서 다시 쓰기"},{"time":"20:50","title":"현장 첨삭과 정리"}]',
    '클래스 2일 전까지 전액 환불. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '8 days 19 hours 30 minutes', base + interval '8 days 21 hours 30 minutes', '여의도', '스터디룸 포커스 여의도점', '서울 영등포구 (샘플 주소)', 8, 3);

  -- 7. 커리어·실무: 발표
  insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
    level, learning_outcomes, materials_note,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h4, 'career', 'class', '떨지 않는 5분 발표 코칭',
    '내 발표를 영상으로 찍고, 강사 피드백을 받아 다시 해 보는 소수 정예 코칭.',
    E'회의나 면접에서 짧게 말해야 할 때 늘 떨리는 분을 위한 실습 중심 클래스입니다.\n\n5분 발표 구조를 배운 뒤, 한 사람씩 발표하고 영상으로 돌려 보며 피드백을 받습니다. 피드백을 반영해 한 번 더 발표하고 달라진 점을 확인해요. 6명 이하로 진행합니다.',
    60000, 1, 'all',
    E'5분 발표를 도입-핵심-마무리 구조로 준비할 수 있어요.\n내 말버릇과 시선 처리를 알고 고칠 수 있어요.',
    '발표 영상은 본인에게만 전달 후 삭제',
    '회의·면접 발표가 부담스러운 분',
    '', '발표하고 싶은 주제 하나 (업무·자기소개 모두 가능)',
    '[{"time":"14:00","title":"5분 발표 구조"},{"time":"14:30","title":"1차 발표와 영상 피드백"},{"time":"15:30","title":"2차 발표와 비교"}]',
    '클래스 3일 전까지 전액 환불. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '13 days 14 hours', base + interval '13 days 16 hours', '강남역', '스터디룸 포커스', '서울 강남구 (샘플 주소)', 6, 2);

  -- 8. 드로잉·공예: 수채 엽서
  insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
    level, learning_outcomes, materials_note,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h2, 'art', 'class', '번지기 기법으로 그리는 수채화 꽃 엽서',
    '물 조절과 번지기만 익히면 꽃 그림이 쉬워져요. 엽서 4장을 완성해 가져가요.',
    E'수채화에서 가장 어려운 물 조절을 집중해서 연습하는 클래스입니다.\n\n색 섞기와 번지기 연습 후, 튤립·라넌큘러스·유칼립투스를 순서대로 그려 엽서 4장을 완성합니다.',
    42000, 2, 'all',
    E'물과 물감의 비율을 조절해 번지기 효과를 낼 수 있어요.\n간단한 꽃을 3단계로 나눠 그릴 수 있어요.',
    '수채 물감·붓·엽서 용지 제공',
    '수채화를 처음 해 보는 분, 손편지를 좋아하는 분',
    '', '없음 (재료 제공)',
    '[{"time":"11:00","title":"색 섞기와 번지기 연습"},{"time":"11:40","title":"꽃 3종 그리기"},{"time":"12:40","title":"엽서 완성과 정리"}]',
    '재료 준비로 인해 클래스 3일 전까지만 전액 환불됩니다. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '2 days 11 hours', base + interval '2 days 13 hours', '익선동', '드로잉 스튜디오 오후', '서울 종로구 (샘플 주소)', 8, 4);

  -- 9. Knowledge: 철학·인문
  insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
    level, learning_outcomes, materials_note,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h5, 'philosophy', 'general', '철학자의 질문으로 내 생각 정리하기',
    '소크라테스의 질문법으로 요즘 가장 큰 고민 하나를 끝까지 따라가 봐요.',
    E'철학 지식을 외우는 시간이 아닙니다. 철학자들이 쓰던 질문 도구를 빌려 내 고민을 정리하는 워크숍이에요.\n\n짧은 발췌문을 함께 읽고, 각자 고민 하나를 질문 사다리로 쪼개 봅니다. 마지막에는 한 장짜리 "생각 지도"를 완성해 가져갑니다.',
    35000, 1, 'all',
    E'막연한 고민을 질문 세 개로 나눠 정리할 수 있어요.\n내 생각의 근거와 전제를 스스로 점검할 수 있어요.',
    '읽을거리·생각 지도 양식 제공',
    '생각이 많지만 정리가 안 되는 분, 인문학을 처음 접하는 분',
    '', '필기구',
    '[{"time":"19:30","title":"발췌문 함께 읽기"},{"time":"20:00","title":"질문 사다리 실습"},{"time":"20:50","title":"생각 지도 완성"}]',
    '프로그램 2일 전까지 전액 환불. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '7 days 19 hours 30 minutes', base + interval '7 days 21 hours 30 minutes', '서촌', '생각 연구소', '서울 종로구 (샘플 주소)', 10, 4);

  -- 검토 중(비공개) 클래스 — 목록에 보이지 않아야 함
  insert into public.meetups (host_id, category_slug, title, summary, description, price, status, is_sample)
  values (h3, 'music', '핑거스타일 기타 중급반 (검토 중)', '공개 전 검토 중인 샘플 클래스입니다. 목록에 나오면 안 됩니다.',
    '검토 중인 샘플 클래스입니다. 공개 목록과 상세 화면에 노출되지 않아야 합니다.', 25000, 'pending_review', true);

  -- 샘플 저널 글 (다시 실행하면 지우고 새로 넣음)
  delete from public.contents where is_sample;
  insert into public.contents (slug, type, status, title, summary, body, author_id, host_id, related_meetup_id, is_sample, published_at) values
  ('sample-filmlog-light', 'article', 'published', '사진은 빛을 읽는 일에서 시작됩니다',
   '필름 현상소를 운영하며 매일 보는 실패한 사진들. 대부분은 장비가 아니라 빛 때문이었어요.',
   E'현상소에서 매일 수백 장의 필름을 봅니다. 초점이 나간 사진보다 훨씬 많은 건, 빛을 보지 않고 찍은 사진이에요.\n\n셔터를 누르기 전에 딱 세 가지만 확인해 보세요. 빛이 어디서 오는지, 그림자가 어느 쪽으로 지는지, 얼굴에 빛이 닿는지. 이 습관 하나로 같은 카메라가 전혀 다른 결과를 냅니다.\n\n다음 프로그램에서는 을지로 골목의 오후 빛으로 이 연습을 직접 해 봅니다. (샘플 글)',
   h1, h1, (select id from public.meetups where host_id = h1 and is_sample and status = 'published' limit 1), true, now() - interval '2 days'),
  ('sample-filmlog-portfolio', 'portfolio', 'published', '을지로, 오후 네 시의 필름',
   '현상소 근처 골목에서 1년 동안 같은 시간에 찍은 필름 사진 기록입니다.',
   E'매일 오후 네 시, 현상소 문을 잠시 닫고 같은 골목을 찍었습니다. 계절이 바뀌면 빛의 각도도 바뀌고, 같은 벽이 전혀 다른 색이 됩니다.\n\n이 기록은 장비가 아니라 시간을 들여 보는 일에 대한 작업이에요. 프로그램에서 실제 필름과 인화본을 함께 볼 수 있어요. (샘플 글)',
   h1, h1, null, true, now() - interval '5 days'),
  ('sample-think-lab-interview', 'interview', 'published', '“답보다 질문을 가져가는 시간” — 생각 연구소 윤재',
   '철학을 외우는 대신 질문 도구를 빌려 쓰는 워크숍. 왜 이런 프로그램을 열었는지 물었습니다.',
   E'Q. 철학 프로그램이라고 하면 어렵게 느끼는 분이 많아요.\n철학자의 이름을 외울 필요는 전혀 없어요. 그분들이 쓰던 질문 방법만 빌려 오면 됩니다.\n\nQ. 참가자들은 무엇을 가져가나요?\n각자 고민 하나를 질문 세 개로 나눈 한 장짜리 생각 지도요. 답을 드리진 않지만, 답을 찾는 방법은 가져가실 수 있어요. (샘플 인터뷰)',
   h5, h5, (select id from public.meetups where host_id = h5 and is_sample and status = 'published' limit 1), true, now() - interval '1 day');
end $$;
