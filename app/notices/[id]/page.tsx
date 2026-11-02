// 사례 상세 화면 (Must 2)
// Design Ref: §5.2 사례 상세, §5.5 화면 점검표
// Plan SC: SC-4 — 공고번호와 나라장터 원문 링크를 반드시 보여준다.
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SummaryBox } from "@/components/SummaryBox";
import { categoryLabel } from "@/lib/categories";
import { formatAmount, formatKstDateTime, g2bNoticeUrl } from "@/lib/format";
import { getNotice } from "@/lib/queries";

async function NoticeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const noticeId = Number(id);
  if (!Number.isInteger(noticeId) || noticeId <= 0) notFound();

  const notice = await getNotice(noticeId);
  if (!notice) notFound();

  const fields: [string, string][] = [
    ["공고기관", notice.notice_inst || "공고에 명시되지 않음"],
    ["수요기관", notice.demand_inst || "공고에 명시되지 않음"],
    ["업무구분", notice.work_type || "공고에 명시되지 않음"],
    ["세부품명", notice.item_name || "공고에 명시되지 않음"],
    ["업종", notice.industry || "공고에 명시되지 않음"],
    ["추정가격(부가세 제외)", formatAmount(notice.amount)],
    ["계약방법", [notice.contract_method, notice.contract_type].filter(Boolean).join(" · ") || "공고에 명시되지 않음"],
    ["공고일자", notice.notice_date],
    ["입찰 마감", notice.close_at ? formatKstDateTime(notice.close_at) : "공고에 명시되지 않음"],
    ["개찰 일시", notice.open_at ? formatKstDateTime(notice.open_at) : "공고에 명시되지 않음"],
  ];

  return (
    <article className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">{notice.title.trim()}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">분야: {categoryLabel(notice.category)}</p>
      </div>

      <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 rounded-lg border border-zinc-200 bg-white p-6 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        {fields.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-zinc-500">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="font-semibold">AI 요약</h3>
        <SummaryBox noticeId={notice.id} initialSummary={notice.summary} sourceUrl={g2bNoticeUrl(notice.biz_no)} />
        {/* 요약 아래에 공고번호와 원문 링크를 반드시 붙인다 (CLAUDE.md 6)) */}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          출처: 공고번호 {notice.biz_no} ·{" "}
          <a
            href={g2bNoticeUrl(notice.biz_no)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:underline dark:text-blue-400"
          >
            나라장터에서 보기 ↗
          </a>
        </p>
      </section>
    </article>
  );
}

export default function NoticePage({ params }: PageProps<"/notices/[id]">) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/#search" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
        ← 목록으로
      </Link>
      <Suspense fallback={<p className="text-sm text-zinc-400">공고를 불러오는 중…</p>}>
        <NoticeDetail params={params} />
      </Suspense>
    </div>
  );
}
