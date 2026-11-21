-- 가상(시연용) 크리에이터 소개 지우기 — 스테이징 전용. "가상 소개"가 들어 있는 항목만 비움 (본인이 쓴 내용은 건드리지 않음)
update public.host_profiles
set headline = case when headline like '%(가상)%' then '' else headline end,
    bio = case when bio like '%가상 소개%' then '' else bio end,
    career = case when career like '%가상 경력%' then '' else career end,
    philosophy = case when philosophy like '%가상 소개%' then '' else philosophy end
where slug in ('hong-jiwan', 'joo-chanwook', 'yang-seunghyo');
