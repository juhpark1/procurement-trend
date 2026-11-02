// 분야 버튼: 전체 · AI 분야 모아 보기 · 8개 분야 · 기타 ("SW 아님"은 없음)
// Design Ref: §5.1 분야 버튼 — 한 번 누르면 그 분야의 월별 차트로 바뀐다 (SC-2: 3클릭 이내)
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";

const TABS = [
  { value: "all", label: "전체" },
  { value: "ai", label: "AI 분야 모아 보기" },
  ...CATEGORIES.filter((category) => !category.excluded).map((category) => ({
    value: category.code,
    label: category.label,
  })),
];

export function CategoryTabs({ selected }: { selected: string }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="분야 선택">
      {TABS.map((tab) => (
        <Link
          key={tab.value}
          href={`/?category=${tab.value}`}
          scroll={false}
          className={`rounded-full border px-3 py-1 text-sm ${
            selected === tab.value
              ? "border-blue-700 bg-blue-700 text-white"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
