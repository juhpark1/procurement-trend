// 공고 목록: 기관 · 사업명 · 금액 · 공고일자 + 공고번호(출처). 20건씩 "더 보기"
// Design Ref: §5.4 NoticeList, §6 (0건 안내)
import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import { formatAmount } from "@/lib/format";
import type { NoticeListItem } from "@/lib/queries";

type Props = {
  items: NoticeListItem[];
  total: number;
  // "더 보기"를 눌렀을 때 갈 주소 (없으면 버튼을 숨김)
  moreHref: string | null;
  emptyMessage: string;
};

export function NoticeList({ items, total, moreHref, emptyMessage }: Props) {
  if (items.length === 0) {
    return <p className="rounded-lg bg-white p-6 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        전체 {total.toLocaleString("ko-KR")}건 중 {items.length.toLocaleString("ko-KR")}건 표시 (공고일자 최신순)
      </p>
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <tr>
              <th className="px-3 py-2 font-medium">수요기관</th>
              <th className="px-3 py-2 font-medium">사업명</th>
              <th className="px-3 py-2 font-medium">분야</th>
              <th className="px-3 py-2 text-right font-medium">추정가격</th>
              <th className="px-3 py-2 font-medium">공고일자</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{item.demand_inst || item.notice_inst}</td>
                <td className="px-3 py-2">
                  <div className="text-black dark:text-zinc-100">{item.title.trim()}</div>
                  <div className="text-xs text-zinc-500">공고번호 {item.biz_no}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                  {categoryLabel(item.category)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatAmount(item.amount)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{item.notice_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {moreHref && items.length < total && (
        <Link
          href={moreHref}
          scroll={false}
          className="self-center rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          더 보기
        </Link>
      )}
    </div>
  );
}
