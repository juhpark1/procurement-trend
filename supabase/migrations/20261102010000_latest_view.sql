-- 재공고 정리: 공고번호가 달라도 "사업명 + 수요기관"이 같으면 같은 사업으로 보고 가장 최근 공고 1건만 남긴 보기(view)
-- Design Ref: §2.2① 처리 4 — PRD "정정·재공고는 같은 사업으로 보고 최신 공고 1건만"
-- 2026-11-02 확인: 2,410건 중 31개 사업이 다른 공고번호로 2~3번 올라와 있었음

create or replace view public.notice_latest
with (security_invoker = true)
as
select distinct on (regexp_replace(trim(n.title), '\s+', ' ', 'g'), n.demand_inst) n.*
from public.notices n
order by regexp_replace(trim(n.title), '\s+', ' ', 'g'), n.demand_inst, n.posted_at desc nulls last, n.biz_no desc;

revoke all on public.notice_latest from public, anon, authenticated;
grant select on public.notice_latest to service_role;

-- 월별 합계도 재공고를 정리한 보기에서 센다
create or replace function public.notice_monthly_stats(p_categories text[] default null)
returns table (month text, notice_count bigint, amount_sum bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select to_char(notice_date, 'YYYY-MM') as month,
         count(*) as notice_count,
         coalesce(sum(amount), 0)::bigint as amount_sum
  from public.notice_latest
  where (category is distinct from 'non_sw')
    and (p_categories is null or category = any (p_categories))
  group by 1
  order by 1;
$$;
