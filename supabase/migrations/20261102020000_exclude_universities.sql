-- 대학 제외 (2026-11-02 사용자 결정): 공고기관·수요기관 이름에 "대학" 또는 "산학협력단"이 들어간 공고는 보기에서 뺀다
-- 앞으로는 수집할 때부터 저장하지 않고(lib/institutions.ts), 이미 저장된 대학 공고는 notices 표에 남겨 두되 화면·집계에서 빠진다.
-- "학교"는 넣지 않는다 — 사관학교·중앙경찰학교 같은 부처 소속 교육기관은 남긴다.

create or replace view public.notice_latest
with (security_invoker = true)
as
select distinct on (regexp_replace(trim(n.title), '\s+', ' ', 'g'), n.demand_inst) n.*
from public.notices n
where n.notice_inst !~ '(대학|산학협력단)'
  and n.demand_inst !~ '(대학|산학협력단)'
order by regexp_replace(trim(n.title), '\s+', ' ', 'g'), n.demand_inst, n.posted_at desc nulls last, n.biz_no desc;

revoke all on public.notice_latest from public, anon, authenticated;
grant select on public.notice_latest to service_role;
