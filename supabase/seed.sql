-- ============================================================================
-- 샘플 데이터 (로컬·CI 전용). 스테이징·운영 DB에는 자동으로 들어가지 않습니다.
-- 모든 행은 is_sample = true 이며 화면에 "샘플"로 표시됩니다.
-- 샘플 호스트 계정은 로그인할 수 없도록 임의 비밀번호로 생성됩니다.
-- ============================================================================

do $$
declare
  h1 uuid := 'a0000000-0000-4000-8000-000000000001';
  h2 uuid := 'a0000000-0000-4000-8000-000000000002';
  h3 uuid := 'a0000000-0000-4000-8000-000000000003';
  h4 uuid := 'a0000000-0000-4000-8000-000000000004';
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
    (h1, 'host-reading@sample.invalid', '책방지기 윤서'),
    (h2, 'host-photo@sample.invalid',   '필름로그 도현'),
    (h3, 'host-music@sample.invalid',   '바이닐 수요일'),
    (h4, 'host-salon@sample.invalid',   '살롱 마루')
  ) as t(id, email, nick);

  insert into public.user_roles (user_id, role) values (h1,'host'),(h2,'host'),(h3,'host'),(h4,'host');

  insert into public.host_profiles (user_id, display_name, headline, bio, expertise, instagram_handle, status, is_sample) values
  (h1, '책방지기 윤서', '연남동 작은 책방에서 7년째 독서모임을 엽니다',
   '출판사 편집자로 일하다 연남동에 작은 책방을 열었습니다. 혼자 읽으면 지나쳤을 문장을 함께 읽으며 다시 발견하는 시간을 좋아해요. 처음 오시는 분도 편하게 이야기할 수 있도록 진행합니다.',
   array['한국 문학','에세이','글쓰기'], 'yunseo.books', 'approved', true),
  (h2, '필름로그 도현', '필름 카메라로 서울의 오래된 골목을 기록합니다',
   '10년 차 사진가이자 필름 현상소 운영자입니다. 비싼 장비보다 천천히 바라보는 눈이 중요하다고 믿어요. 카메라가 없어도 대여해 드립니다.',
   array['필름 사진','거리 사진','현상'], 'filmlog.dh', 'approved', true),
  (h3, '바이닐 수요일', '좋은 스피커로 앨범 한 장을 처음부터 끝까지',
   '을지로에서 리스닝 바를 운영하는 두 사람입니다. 플레이리스트가 아닌 앨범 단위로 음악을 듣고, 그 앨범이 만들어진 시대 이야기를 나눕니다.',
   array['시티팝','재즈','LP 큐레이션'], 'vinyl.wed', 'approved', true),
  (h4, '살롱 마루', '일과 삶에 대한 질문을 함께 생각하는 인문 살롱',
   '철학을 전공한 기획자와 HR 담당자가 함께 만드는 살롱입니다. 정답을 찾기보다 좋은 질문을 함께 만들어 가는 대화를 지향합니다.',
   array['철학','커리어','대화 진행'], null, 'approved', true);

  -- 1. 독서
  insert into public.meetups (host_id, category_slug, title, summary, description, price, max_quantity_per_booking,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h1, 'reading', '한 달에 한 권, 『작별하지 않는다』 함께 읽기',
    '한강 작가의 소설을 미리 읽고 와서, 가장 오래 남은 문장 하나로 대화를 시작해요.',
    E'한 달에 한 권, 같은 책을 읽고 모여 이야기하는 독서 모임입니다.\n\n이번 달은 한강 작가의 『작별하지 않는다』를 함께 읽습니다. 책을 다 읽지 못했어도 괜찮아요. 각자 가장 오래 마음에 남은 문장을 하나씩 가져와 그 문장에서 대화를 시작합니다.\n\n모임이 끝나면 다음 달에 읽을 책을 함께 고릅니다.',
    25000, 1, '책을 좋아하지만 혼자 읽는 게 아쉬웠던 분, 처음 독서모임에 참여해 보는 분',
    '책을 미리 읽어 오시면 좋아요 (완독 필수 아님)', '책 (종이책·전자책 모두 가능), 마음에 남은 문장 메모',
    '[{"time":"14:00","title":"인사와 자기소개"},{"time":"14:20","title":"각자의 문장 나누기"},{"time":"15:10","title":"주제 토론"},{"time":"15:50","title":"다음 달 책 고르기"}]',
    '모임 3일 전까지 전액 환불, 이후 취소 시 환불이 어렵습니다. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '5 days 14 hours', base + interval '5 days 16 hours', '연남동', '책방 오후의 문장', '서울 마포구 (샘플 주소)', 8, 6),
    (m, base + interval '19 days 14 hours', base + interval '19 days 16 hours', '연남동', '책방 오후의 문장', '서울 마포구 (샘플 주소)', 8, 1);

  -- 2. 사진
  insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h2, 'photo', 'outdoor', '필름 카메라로 걷는 서촌 골목 출사',
    '필름 한 롤을 들고 서촌의 오래된 골목을 천천히 걸어요. 카메라는 무료로 빌려드립니다.',
    E'디지털과 달리 한 롤에 36장뿐인 필름 카메라는 셔터를 누르기 전 한 번 더 바라보게 만듭니다.\n\n통인시장에서 출발해 서촌의 골목과 수성동 계곡까지 약 2시간 동안 걸으며 촬영합니다. 노출과 구도의 기본을 현장에서 알려드리고, 촬영한 필름은 현상해서 스캔본을 보내드립니다.\n\n카메라가 없으신 분은 신청 시 알려주시면 대여해 드려요.',
    35000, 2, '필름 사진을 처음 시작하는 분, 친구와 함께 새로운 취미를 찾는 분',
    '2시간 정도 걸을 수 있는 체력', '편한 신발, (있다면) 필름 카메라',
    '[{"time":"10:00","title":"통인시장 앞 집결, 카메라 사용법"},{"time":"10:30","title":"서촌 골목 출사"},{"time":"11:40","title":"수성동 계곡"},{"time":"12:10","title":"근처 카페에서 마무리"}]',
    '모임 2일 전까지 전액 환불. 필름 현상비가 포함되어 있습니다. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '6 days 10 hours', base + interval '6 days 12 hours 30 minutes', '서촌', '통인시장 정문', '서울 종로구 (샘플 주소)', 6, 5);

  -- 3. 음악
  insert into public.meetups (host_id, category_slug, title, summary, description, price, max_quantity_per_booking,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h3, 'music', 'LP 리스닝 세션 — 80년대 시티팝 특집',
    '좋은 스피커로 앨범 두 장을 처음부터 끝까지. 노래가 만들어진 시대 이야기도 함께.',
    E'플레이리스트가 아닌 "앨범"으로 음악을 듣는 시간입니다.\n\n이번 회차는 80년대 일본 시티팝 명반 두 장을 A면부터 B면까지 온전히 듣습니다. 곡 사이사이 앨범이 만들어진 배경과 당시 도시의 분위기를 짧게 소개해 드려요.\n\n음악을 들을 때는 대화를 멈추고, 듣고 난 뒤 자유롭게 감상을 나눕니다. 논알콜 음료가 제공됩니다.',
    30000, 2, '음악을 좋아하는 누구나, 혼자 와도 어색하지 않은 모임을 찾는 분',
    '', '없음',
    '[{"time":"19:30","title":"웰컴 드링크(논알콜)와 소개"},{"time":"19:45","title":"첫 번째 앨범 감상"},{"time":"20:30","title":"쉬는 시간과 이야기"},{"time":"20:45","title":"두 번째 앨범 감상"},{"time":"21:30","title":"감상 나누기"}]',
    '모임 3일 전까지 전액 환불. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '3 days 19 hours 30 minutes', base + interval '3 days 22 hours', '을지로', '리스닝룸 수요일', '서울 중구 (샘플 주소)', 12, 12),
    (m, base + interval '10 days 19 hours 30 minutes', base + interval '10 days 22 hours', '을지로', '리스닝룸 수요일', '서울 중구 (샘플 주소)', 12, 4);

  -- 4. 철학
  insert into public.meetups (host_id, category_slug, title, summary, description, price, max_quantity_per_booking,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h4, 'philosophy', '퇴근 후 철학 살롱: 우리는 왜 일하는가',
    '짧은 철학 텍스트 한 편을 함께 읽고, 각자의 일에 대해 솔직하게 이야기하는 저녁.',
    E'"일을 좋아해야 한다"는 말이 부담스러웠던 적 있나요?\n\n이번 살롱에서는 한나 아렌트의 『인간의 조건』 중 노동과 작업에 관한 짧은 발췌문을 함께 읽습니다. 사전 지식은 필요 없어요. 진행자가 핵심을 쉽게 풀어 드리고, 각자의 일 경험과 연결해 이야기 나눕니다.\n\n발췌문은 신청 후 미리 보내 드립니다.',
    20000, 1, '일의 의미를 한 번쯤 고민해 본 직장인, 다른 업계 사람들과 대화하고 싶은 분',
    '', '없음 (읽을거리는 현장에서도 제공)',
    '[{"time":"19:30","title":"발췌문 함께 읽기"},{"time":"20:00","title":"소그룹 대화"},{"time":"20:50","title":"전체 나눔과 마무리"}]',
    '모임 2일 전까지 전액 환불. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '8 days 19 hours 30 minutes', base + interval '8 days 21 hours 30 minutes', '합정동', '살롱 마루', '서울 마포구 (샘플 주소)', 10, 3);

  -- 5. 네트워킹
  insert into public.meetups (host_id, category_slug, title, summary, description, price, max_quantity_per_booking,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h4, 'networking', '1인 브랜드 운영자 모닝 커피 네트워킹',
    '혼자 일하는 사람들끼리 고민과 노하우를 나누는 토요일 아침 2시간.',
    E'프리랜서, 1인 창업자, 사이드 프로젝트를 운영하는 분들이 모이는 아침 네트워킹입니다.\n\n명함 교환보다 대화에 집중할 수 있도록 4~5명씩 테이블을 나누고, 30분마다 자리를 바꿉니다. 각 테이블에는 "요즘 가장 큰 고민" 카드가 놓여 있어요.\n\n커피 한 잔이 참가비에 포함되어 있습니다.',
    15000, 2, '프리랜서, 1인 창업자, 사이드 프로젝트 운영자',
    '', '자기소개 한 줄 (명함은 선택)',
    '[{"time":"10:00","title":"체크인과 커피"},{"time":"10:15","title":"테이블 대화 1"},{"time":"10:45","title":"테이블 대화 2"},{"time":"11:15","title":"테이블 대화 3"},{"time":"11:45","title":"자유 네트워킹"}]',
    '모임 1일 전까지 전액 환불. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '4 days 10 hours', base + interval '4 days 12 hours', '성수동', '카페 레이어드 2층', '서울 성동구 (샘플 주소)', 16, 9);

  -- 6. 아트·클래스
  insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h2, 'art', 'class', '그림 초보를 위한 익선동 어반 스케치',
    '펜 하나와 작은 수채 팔레트로 한옥 골목을 그려요. 재료는 모두 준비되어 있습니다.',
    E'"그림은 못 그려요"라고 말하는 분들을 위한 클래스입니다.\n\n처음 30분은 선 긋기와 원근의 아주 기본만 연습하고, 이후 익선동 한옥 골목으로 나가 한 장면을 골라 그립니다. 잘 그리는 것보다 오래 바라보는 경험에 집중해요.\n\n스케치북, 펜, 휴대용 수채 팔레트를 드리며 가져가실 수 있습니다.',
    40000, 2, '그림을 배워 본 적 없는 분, 손으로 하는 취미를 찾는 분',
    '', '없음 (재료 제공)',
    '[{"time":"14:00","title":"선 긋기·원근 기초"},{"time":"14:30","title":"골목 스케치"},{"time":"15:40","title":"채색"},{"time":"16:10","title":"작품 나누기"}]',
    '재료 준비로 인해 모임 4일 전까지만 전액 환불됩니다. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '12 days 14 hours', base + interval '12 days 16 hours 30 minutes', '익선동', '익선 스튜디오', '서울 종로구 (샘플 주소)', 8, 2);

  -- 7. 아웃도어
  insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h4, 'outdoor', 'outdoor', '한강 선셋 5km 러닝 & 가벼운 저녁',
    '노을이 지는 반포 한강을 천천히 5km 달리고, 근처에서 가볍게 저녁을 먹어요.',
    E'기록보다 함께 달리는 즐거움에 집중하는 러닝 모임입니다.\n\n1km당 6분 30초~7분 페이스로 반포 한강공원을 달리며, 페이스가 다른 분들을 위해 두 그룹으로 나눕니다. 러닝 후에는 근처 식당에서 가볍게 식사하며 이야기 나눠요 (식사비 개인 부담).\n\n우천 시 일정이 변경되며, 변경 시 전액 환불됩니다.',
    10000, 2, '5km를 쉬지 않고 뛰어 본 적 있는 분, 함께 달릴 친구를 찾는 분',
    '5km 완주 경험 권장', '러닝화, 물, 가벼운 겉옷',
    '[{"time":"18:30","title":"집결과 스트레칭"},{"time":"18:45","title":"5km 러닝"},{"time":"19:30","title":"쿨다운"},{"time":"19:45","title":"저녁 식사(선택)"}]',
    '모임 1일 전까지 전액 환불, 우천 취소 시 전액 환불. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '2 days 18 hours 30 minutes', base + interval '2 days 20 hours 30 minutes', '반포', '반포 한강공원 달빛광장', '서울 서초구 (샘플 주소)', 20, 14),
    (m, base + interval '9 days 18 hours 30 minutes', base + interval '9 days 20 hours 30 minutes', '반포', '반포 한강공원 달빛광장', '서울 서초구 (샘플 주소)', 20, 3);

  -- 8. 여행

  insert into public.meetups (host_id, category_slug, title, summary, description, price, max_quantity_per_booking,
    target_audience, requirements, what_to_bring, agenda, refund_policy_text, status, is_sample, published_at)
  values (h1, 'travel', '혼자 떠나는 첫 제주 여행 준비 모임',
    '혼자 여행이 처음이라면, 다녀온 사람들과 동선과 숙소, 안전 팁을 함께 짜 봐요.',
    E'혼자 여행을 꿈꾸지만 막상 떠나기 망설여지는 분들을 위한 모임입니다.\n\n제주를 혼자 여러 번 다녀온 진행자가 계절별 추천 동선, 1인 여행자에게 좋은 숙소 고르는 법, 대중교통 이용 팁을 정리해 드려요. 이후 각자 가고 싶은 곳을 바탕으로 2박 3일 일정을 직접 짜 봅니다.',
    18000, 1, '혼자 여행을 처음 계획하는 분', '', '노트북 또는 메모할 수 있는 도구',
    '[{"time":"14:00","title":"제주 1인 여행 기본 정보"},{"time":"14:40","title":"내 일정 짜기"},{"time":"15:30","title":"일정 공유와 피드백"}]',
    '모임 2일 전까지 전액 환불. (샘플 문구)', 'published', true, now())
  returning id into m;
  insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity, reserved_count) values
    (m, base + interval '13 days 14 hours', base + interval '13 days 16 hours', '망원동', '책방 오후의 문장 2층', '서울 마포구 (샘플 주소)', 10, 2);

  -- 검토 중(비공개) 모임 — 목록에 보이지 않아야 함
  insert into public.meetups (host_id, category_slug, title, summary, description, price, status, is_sample)
  values (h3, 'music', '재즈 피아노 트리오 감상회 (검토 중)', '공개 전 검토 중인 샘플 모임입니다. 목록에 나오면 안 됩니다.',
    '검토 중인 샘플 모임입니다. 공개 목록과 상세 화면에 노출되지 않아야 합니다.', 25000, 'pending_review', true);
end $$;
