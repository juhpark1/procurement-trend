-- 공고(notices)와 수집 기록(runs) 표
-- Design Ref: §3.1, §3.2 — 표 이름·칸 이름은 DESIGN.md와 같다.
-- Design Ref: §7 — RLS(행 단위 접근 제어)를 켜고 공개 접근 규칙은 두지 않는다. 서버 코드만 service role 키로 읽고 쓴다.

create table if not exists public.notices (
  id bigint generated always as identity primary key,
  biz_no text not null unique,          -- 사업번호(공고번호), 중복 판단 기준
  biz_ord text not null,                -- 차수, 클수록 최신(정정·재공고)
  title text not null,                  -- 사업명
  notice_inst text not null default '', -- 공고기관
  demand_inst text not null default '', -- 수요기관
  top_inst_code text not null,          -- 최상위기관코드
  work_type text not null default '',   -- 업무구분 (일반용역·기술용역)
  item_name text not null default '',   -- 세부품명 (분류 근거)
  industry text not null default '',    -- 업종 (표시·요약용)
  contract_method text not null default '',
  contract_type text not null default '',
  amount bigint,                        -- 추정가격(부가세 제외), 없으면 null
  notice_date date not null,            -- 공고일자 (월별 집계 기준)
  posted_at timestamptz,                -- 공고 게시 일시
  open_at timestamptz,                  -- 개찰 일시
  close_at timestamptz,                 -- 입찰 마감 일시
  ref_no text not null default '',      -- 참조번호
  content_hash text not null,           -- 내용이 바뀌었는지 비교하는 값
  category text,                        -- 분야 코드 (lib/categories.ts), null이면 분류 전
  summary text,                         -- AI 요약, null이면 아직 없음
  summary_started_at timestamptz,       -- 요약을 만들기 시작한 시각 (중복 생성 방지)
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notices_notice_date_idx on public.notices (notice_date desc);
create index if not exists notices_category_idx on public.notices (category);

create table if not exists public.runs (
  id bigint generated always as identity primary key,
  kind text not null,                   -- main(본 실행) / retry(재시도) / manual(수동)
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running', -- running / success / partial / failed / skipped
  period_from date,
  period_to date,
  pages_total int not null default 0,
  pages_failed int not null default 0,
  fetched int not null default 0,       -- 받은 건수 (전체 기관)
  kept int not null default 0,          -- 대상(중앙부처)만 남긴 건수
  inserted int not null default 0,
  updated int not null default 0,
  classified int not null default 0,
  error text                            -- 실패 이유 (비밀 값 제외)
);

create index if not exists runs_started_at_idx on public.runs (started_at desc);

alter table public.notices enable row level security;
alter table public.runs enable row level security;

-- 월별 건수·금액 합계 (분야 목록을 주면 그 분야만, 비우면 전체). "SW 아님"은 항상 제외
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
  from public.notices
  where (category is distinct from 'non_sw')
    and (p_categories is null or category = any (p_categories))
  group by 1
  order by 1;
$$;

-- 함수는 서버(service role)만 부를 수 있게 한다
revoke all on function public.notice_monthly_stats(text[]) from public, anon, authenticated;
grant execute on function public.notice_monthly_stats(text[]) to service_role;
