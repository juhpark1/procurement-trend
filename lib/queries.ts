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
