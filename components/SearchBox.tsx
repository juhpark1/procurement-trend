// 유사 사례 검색창: 키워드 + 분야 선택
// Design Ref: §5.1 [B] 유사 사례 찾기, §5.4 SearchBox
// 서버로 바로 보내는 일반 양식(form)이라 자바스크립트 없이도 동작한다.
import { CATEGORIES } from "@/lib/categories";

type Props = {
  keyword: string;
  searchCategory: string;
  // 차트에서 고른 분야는 검색 후에도 유지
  chartCategory: string;
};

export function SearchBox({ keyword, searchCategory, chartCategory }: Props) {
  return (
    <form action="/" method="get" className="flex flex-wrap gap-2">
      <input type="hidden" name="category" value={chartCategory} />
      <input
        type="search"
        name="q"
        defaultValue={keyword}
        placeholder="키워드 입력 (예: 챗봇, 클라우드, 유지관리)"
        maxLength={50}
        className="min-w-64 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <select
        name="scat"
        defaultValue={searchCategory}
        aria-label="검색할 분야"
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="all">모든 분야</option>
        <option value="ai">AI 분야 모아 보기</option>
        {CATEGORIES.filter((category) => !category.excluded).map((category) => (
          <option key={category.code} value={category.code}>
            {category.label}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-white hover:bg-blue-800">
        검색
      </button>
    </form>
  );
}
