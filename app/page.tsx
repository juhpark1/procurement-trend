// 첫 화면 [A] 분야별 발주 추이 (Must 1)
// Design Ref: §5.1 첫 화면, §2.2② 대시보드 흐름
// Plan SC: SC-2 (분야 버튼 1번으로 분야별 월별 추이), SC-4 (합계를 누르면 포함된 공고 목록)
import Link from "next/link";
import { Suspense } from "react";
import { CategoryTabs } from "@/components/CategoryTabs";
import { NoticeList } from "@/components/NoticeList";
import { TrendChart, type ChartPoint } from "@/components/TrendChart";
import { CATEGORIES } from "@/lib/categories";
import { currentKstMonth, formatAmount, formatMonth } from "@/lib/format";
import { getMonthlyStats, getMonthNotices } from "@/lib/queries";

const PAGE_SIZE = 20;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// 주소의 ?category= 값을 확인한다 (모르는 값이면 전체)
function readCategory(value: unknown): string {
  const valid = ["all", "ai", ...CATEGORIES.filter((category) => !category.excluded).map((category) => category.code)];
  return typeof value === "string" && valid.includes(value) ? value : "all";
}

function readMonth(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value) ? value : null;
}

function readLimit(value: unknown): number {
  const limit = Number(value);
  return Number.isInteger(limit) && limit >= PAGE_SIZE && limit <= 1000 ? limit : PAGE_SIZE;
}

async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const category = readCategory(params.category);
  const selectedMonth = readMonth(params.month);
  const limit = readLimit(params.limit);

  const stats = await getMonthlyStats(category);
  // 수집 첫 달과 진행 중인 달은 "부분 데이터"
  const firstMonth = stats[0]?.month;
  const thisMonth = currentKstMonth();
  const points: ChartPoint[] = stats.map((stat) => ({
    month: stat.month,
    label: formatMonth(stat.month),
    noticeCount: stat.noticeCount,
    amountEok: Math.round(stat.amountSum / 100_000_000),
    partial: stat.month === firstMonth || stat.month === thisMonth,
  }));

  const list = selectedMonth ? await getMonthNotices(selectedMonth, category, limit) : null;
  const categoryName =
    category === "all"
      ? "전체"
      : category === "ai"
        ? "AI 분야 모아 보기"
        : (CATEGORIES.find((item) => item.code === category)?.label ?? "전체");

  return (
    <>
      <CategoryTabs selected={category} />

      {points.length === 0 ? (
        <p className="rounded-lg bg-white p-6 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          아직 이 분야로 분류된 공고가 없습니다.
        </p>
      ) : (
        <>
          <TrendChart data={points} category={category} selectedMonth={selectedMonth} />

          {/* 월별 합계: 숫자를 누르면 그 달에 포함된 공고 목록이 열린다 */}
          <div className="flex flex-wrap gap-3">
            {points.map((point) => (
              <Link
                key={point.month}
                href={`/?category=${category}&month=${point.month}#list`}
                scroll={false}
                className={`rounded-lg border px-4 py-3 text-sm ${
                  point.month === selectedMonth
                    ? "border-blue-700 bg-blue-50 dark:bg-blue-950"
                    : "border-zinc-200 bg-white hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                <div className="font-medium">
                  {point.label}
                  {point.partial && <span className="ml-1 text-xs text-amber-600">부분 데이터</span>}
                </div>
                <div className="text-zinc-700 dark:text-zinc-300">
                  {point.noticeCount.toLocaleString("ko-KR")}건 ·{" "}
                  {formatAmount(stats.find((stat) => stat.month === point.month)?.amountSum ?? null)}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {selectedMonth && list && (
        <section id="list" className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">
            {formatMonth(selectedMonth)} · {categoryName} 공고 목록
          </h3>
          <NoticeList
            items={list.items}
            total={list.total}
            moreHref={`/?category=${category}&month=${selectedMonth}&limit=${limit + PAGE_SIZE}#list`}
            emptyMessage="해당 월 공고 없음"
          />
        </section>
      )}
    </>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">분야별 발주 추이</h2>
        <p className="text-sm text-zinc-500">
          중앙부처 SW 사업 입찰공고의 월별 건수와 추정가격(부가세 제외) 합계예요. 재공고는 1건으로 셉니다.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-400">추이를 불러오는 중…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
