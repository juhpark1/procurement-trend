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
import { ExportForm } from "@/components/ExportForm";
import { SearchBox } from "@/components/SearchBox";
import { getMonthlyStats, getMonthNotices, getStartDate, searchNotices } from "@/lib/queries";

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

// 한 번에 보여주는 최대 건수 (Supabase가 한 번에 1,000줄까지만 주므로 그 이상은 "더 보기"를 숨김)
const MAX_LIMIT = 1000;

function readLimit(value: unknown): number {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < PAGE_SIZE) return PAGE_SIZE;
  return Math.min(limit, MAX_LIMIT);
}

async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const category = readCategory(params.category);
  const selectedMonth = readMonth(params.month);
  const limit = readLimit(params.limit);

  const [stats, startDate] = await Promise.all([getMonthlyStats(category), getStartDate()]);
  // 수집 첫 달(수집 시작일이 든 달)과 진행 중인 달은 "부분 데이터"
  // 분야를 고르면 그 분야의 첫 공고가 나온 달이 달라질 수 있어, 분야와 상관없이 수집 시작일로 정한다
  const firstMonth = startDate?.slice(0, 7);
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
            moreHref={
              limit >= MAX_LIMIT ? null : `/?category=${category}&month=${selectedMonth}&limit=${limit + PAGE_SIZE}#list`
            }
            emptyMessage="해당 월 공고 없음"
          />
        </section>
      )}
    </>
  );
}

// [B] 유사 사례 찾기 (Must 2)
// Design Ref: §5.1 [B], §2.2③ 검색 규칙
async function Search({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const chartCategory = readCategory(params.category);
  const keyword = typeof params.q === "string" ? params.q.trim().slice(0, 50) : "";
  const searchCategory = readCategory(params.scat);
  const limit = readLimit(params.slimit);
  const hasQuery = keyword !== "" || searchCategory !== "all";

  const result = hasQuery ? await searchNotices(keyword, searchCategory, limit) : null;
  const moreParams = new URLSearchParams({
    category: chartCategory,
    q: keyword,
    scat: searchCategory,
    slimit: String(limit + PAGE_SIZE),
  });

  return (
    <div className="flex flex-col gap-3">
      <SearchBox keyword={keyword} searchCategory={searchCategory} chartCategory={chartCategory} />
      {result && result.items.length > 0 && result.topCategory && (
        <p className="text-sm text-zinc-500">
          사업명에 &ldquo;{keyword}&rdquo;가 든 공고와, 그 공고들에서 가장 많은 분야(
          {CATEGORIES.find((category) => category.code === result.topCategory)?.label})의 공고를 함께 보여줘요.
        </p>
      )}
      {result && result.items.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-lg bg-white p-6 dark:bg-zinc-900">
          <p className="text-zinc-600 dark:text-zinc-400">검색 결과가 없습니다. 검색어를 바꾸거나 분야로 찾아보세요.</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter((category) => !category.excluded).map((category) => (
              <Link
                key={category.code}
                href={`/?category=${chartCategory}&scat=${category.code}#search`}
                scroll={false}
                className="rounded-full border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {category.label}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        result && (
          <NoticeList
            items={result.items}
            total={result.total}
            moreHref={limit >= MAX_LIMIT ? null : `/?${moreParams.toString()}#search`}
            emptyMessage=""
          />
        )
      )}
    </div>
  );
}

// [C] 월별 목록 내려받기 — 오늘 날짜를 쓰므로 요청 때 그린다 (주소 값을 읽어 요청 시점 렌더링으로 둠)
async function Export({ searchParams }: { searchParams: SearchParams }) {
  await searchParams;
  const thisMonth = currentKstMonth();
  const thisYear = Number(thisMonth.slice(0, 4));
  // 수집은 2026년에 시작했으므로 2026년부터 올해까지
  const years = Array.from({ length: thisYear - 2026 + 1 }, (_, index) => 2026 + index);
  return <ExportForm years={years} defaultMonth={thisMonth} />;
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
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

    <section id="search" className="flex flex-col gap-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <div>
        <h2 className="text-xl font-semibold">유사 사례 찾기</h2>
        <p className="text-sm text-zinc-500">
          키워드나 분야로 비슷한 발주 사례를 찾아요. 사업명을 누르면 상세 정보와 AI 요약을 볼 수 있어요.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-400">검색 준비 중…</p>}>
        <Search searchParams={searchParams} />
      </Suspense>
    </section>

    <section className="flex flex-col gap-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <div>
        <h2 className="text-xl font-semibold">월별 목록 내려받기</h2>
        <p className="text-sm text-zinc-500">연·월을 고르면 그 달 공고 목록을 CSV 파일로 내려받아요.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-400">준비 중…</p>}>
        <Export searchParams={searchParams} />
      </Suspense>
    </section>
    </>
  );
}
