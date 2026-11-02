// 화면에서 쓰는 데이터 읽기 — 모두 재공고·대학을 정리한 notice_latest 보기에서 읽는다
// Design Ref: §2.2② 대시보드 흐름, §3.1-2 notice_latest, §3.2 runs
import { AI_CATEGORY_CODES, CATEGORIES } from "@/lib/categories";
import { db, type NoticeRow, type RunRow } from "@/lib/db";

// 화면 분야 선택값: "all"(전체), "ai"(AI 분야 모아 보기), 또는 분야 코드
export type CategoryFilter = string;

// 분야 선택값 → 조회할 분야 코드 목록 (null이면 전체, "SW 아님"은 항상 제외)
export function categoryCodes(filter: CategoryFilter): string[] | null {
  if (filter === "ai") return AI_CATEGORY_CODES;
  if (CATEGORIES.some((category) => category.code === filter && !category.excluded)) return [filter];
  return null;
}

export type Status = {
  lastRun: Pick<RunRow, "finished_at" | "status"> | null;
  startDate: string | null;
  institutionCount: number;
};

// 상태 줄: 마지막 수집, 수집 시작일(가장 이른 공고일자), 수집 대상 기관 수
export async function getStatus(): Promise<Status> {
  const [{ data: runs }, { data: earliest }] = await Promise.all([
    db()
      .from("runs")
      .select("finished_at, status")
      .in("status", ["success", "partial"])
      .order("finished_at", { ascending: false })
      .limit(1),
    db().from("notice_latest").select("notice_date").order("notice_date", { ascending: true }).limit(1),
  ]);

  // 기관 수는 최상위기관코드 종류 수 (1,000줄씩 나눠 읽음)
  const codes = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await db()
      .from("notice_latest")
      .select("top_inst_code")
      .range(from, from + 999);
    for (const row of data ?? []) codes.add(row.top_inst_code);
    if (!data || data.length < 1000) break;
  }

  return {
    lastRun: runs?.[0] ?? null,
    startDate: earliest?.[0]?.notice_date ?? null,
    institutionCount: codes.size,
  };
}

export type MonthStat = { month: string; noticeCount: number; amountSum: number };

// 월별 건수·추정가격 합계
export async function getMonthlyStats(filter: CategoryFilter): Promise<MonthStat[]> {
  const { data, error } = await db().rpc("notice_monthly_stats", { p_categories: categoryCodes(filter) });
  if (error) throw new Error(`월별 합계 조회 실패: ${error.message}`);
  return (data as { month: string; notice_count: number; amount_sum: number }[]).map((row) => ({
    month: row.month,
    noticeCount: Number(row.notice_count),
    amountSum: Number(row.amount_sum),
  }));
}

export type NoticeListItem = Pick<
  NoticeRow,
  "id" | "biz_no" | "title" | "demand_inst" | "notice_inst" | "amount" | "notice_date" | "category"
>;

export type SearchItem = NoticeListItem & { sameCategory: boolean };

// 검색어 안의 특수 문자를 글자 그대로 찾도록 처리 (%, _, \)
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const LIST_COLUMNS = "id, biz_no, title, demand_inst, notice_inst, amount, notice_date, category";

// 유사 사례 검색 ("SW 아님"은 항상 제외)
// Design Ref: §2.2③ 검색 규칙
//  · 키워드만: 사업명에 키워드가 든 공고 + 그 공고들에서 가장 많은 분야의 공고 ("같은 분야" 표시)
//  · 분야만: 그 분야 공고
//  · 둘 다: 사업명에 키워드가 들고 그 분야인 공고
//  · 공고일자 최신순, 같은 공고는 한 번만, limit건까지
export async function searchNotices(
  keyword: string,
  filter: CategoryFilter,
  limit: number,
): Promise<{ items: SearchItem[]; total: number; topCategory: string | null }> {
  const codes = categoryCodes(filter);
  const base = () =>
    db().from("notice_latest").select(LIST_COLUMNS).or("category.is.null,category.neq.non_sw").limit(1000);

  let keywordMatches: NoticeListItem[] = [];
  if (keyword) {
    let query = base().ilike("title", `%${escapeLike(keyword)}%`);
    if (codes) query = query.in("category", codes);
    const { data, error } = await query;
    if (error) throw new Error(`검색 실패: ${error.message}`);
    keywordMatches = (data ?? []) as NoticeListItem[];
  }

  // 키워드만 있을 때: 키워드 일치 공고에서 가장 많은 분야를 "같은 분야"로 함께 보여준다
  let topCategory: string | null = null;
  let categoryMatches: NoticeListItem[] = [];
  if (keyword && !codes) {
    const counts = new Map<string, number>();
    for (const item of keywordMatches) {
      if (item.category) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    topCategory = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    if (topCategory) {
      const { data, error } = await base().eq("category", topCategory);
      if (error) throw new Error(`같은 분야 조회 실패: ${error.message}`);
      categoryMatches = (data ?? []) as NoticeListItem[];
    }
  } else if (!keyword && codes) {
    const { data, error } = await base().in("category", codes);
    if (error) throw new Error(`분야 조회 실패: ${error.message}`);
    categoryMatches = (data ?? []) as NoticeListItem[];
  }

  // 키워드 일치를 먼저 넣고, 같은 분야 공고는 중복 없이 더한다
  const merged = new Map<number, SearchItem>();
  for (const item of keywordMatches) merged.set(item.id, { ...item, sameCategory: false });
  for (const item of categoryMatches) {
    if (!merged.has(item.id)) merged.set(item.id, { ...item, sameCategory: Boolean(keyword) });
  }

  const sorted = [...merged.values()].sort(
    (a, b) => b.notice_date.localeCompare(a.notice_date) || b.id - a.id,
  );
  return { items: sorted.slice(0, limit), total: sorted.length, topCategory };
}

// 사례 상세 한 건 (없으면 null)
export async function getNotice(id: number): Promise<NoticeRow | null> {
  const { data, error } = await db().from("notices").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`공고 조회 실패: ${error.message}`);
  return (data as NoticeRow | null) ?? null;
}

// 그 달·그 분야의 공고 목록 (최신순, limit건). total은 전체 건수
export async function getMonthNotices(
  month: string,
  filter: CategoryFilter,
  limit: number,
): Promise<{ items: NoticeListItem[]; total: number }> {
  const [year, mon] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, mon, 1)).toISOString().slice(0, 10);

  let query = db()
    .from("notice_latest")
    .select("id, biz_no, title, demand_inst, notice_inst, amount, notice_date, category", { count: "exact" })
    .gte("notice_date", start)
    .lt("notice_date", end)
    .or("category.is.null,category.neq.non_sw");

  const codes = categoryCodes(filter);
  if (codes) query = query.in("category", codes);

  const { data, count, error } = await query
    .order("notice_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`공고 목록 조회 실패: ${error.message}`);
  return { items: (data ?? []) as NoticeListItem[], total: count ?? 0 };
}
