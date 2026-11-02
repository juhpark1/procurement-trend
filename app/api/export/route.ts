// 월별 CSV 내려받기 — /api/export?month=YYYY-MM
// Design Ref: §2.2④ CSV 흐름, "CSV 구성"
// Plan SC: SC-6 — 차트 "전체"와 같은 조건("SW 아님"만 제외, 분류 전 공고 포함)으로 세어 건수가 100% 일치하게 한다.
import type { NextRequest } from "next/server";
import { categoryLabel } from "@/lib/categories";
import { db } from "@/lib/db";
import { currentKstMonth, g2bNoticeUrl } from "@/lib/format";

const SOURCE = "조달청 나라장터(URL정보제공서비스)";
const HEADER = [
  "공고번호",
  "차수",
  "사업명",
  "분야",
  "공고기관",
  "수요기관",
  "업무구분",
  "세부품명",
  "추정가격(원)",
  "공고일",
  "마감일시",
  "나라장터 링크",
  "출처",
];

type ExportRow = {
  biz_no: string;
  biz_ord: string;
  title: string;
  category: string | null;
  notice_inst: string;
  demand_inst: string;
  work_type: string;
  item_name: string;
  amount: number | null;
  notice_date: string;
  close_at: string | null;
};

// 칸 값에 쉼표·따옴표·줄바꿈이 있어도 깨지지 않게 감싼다
function cell(value: string | number | null): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

// ISO 일시 → 한국 시간 "YYYY-MM-DD HH:MM"
function kst(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");
}

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return Response.json({ message: "month는 YYYY-MM 형식이어야 합니다." }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, mon, 1)).toISOString().slice(0, 10);

  // Supabase는 한 번에 1,000줄까지라 나눠서 모두 읽는다
  const rows: ExportRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from("notice_latest")
      .select("biz_no, biz_ord, title, category, notice_inst, demand_inst, work_type, item_name, amount, notice_date, close_at")
      .gte("notice_date", start)
      .lt("notice_date", end)
      .or("category.is.null,category.neq.non_sw")
      .order("notice_date", { ascending: false })
      .order("biz_no", { ascending: true })
      .range(from, from + 999);
    if (error) return Response.json({ message: "공고 조회 실패" }, { status: 500 });
    rows.push(...(data as ExportRow[]));
    if (data.length < 1000) break;
  }

  if (rows.length === 0) {
    return Response.json({ message: "해당 월 공고 없음" }, { status: 404 });
  }

  // 부분 데이터: 진행 중인 달은 오늘까지, 수집 첫 달은 가장 이른 공고일부터
  const { data: earliest } = await db()
    .from("notice_latest")
    .select("notice_date")
    .order("notice_date", { ascending: true })
    .limit(1);
  const startDate: string | null = earliest?.[0]?.notice_date ?? null;
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  let fileName = `g2b-notices-${month}.csv`;
  let partialNote = "";
  if (month === currentKstMonth()) {
    fileName = `g2b-notices-${month}-partial-to-${today.replaceAll("-", "")}.csv`;
    partialNote = `부분 데이터(${today}까지)`;
  } else if (startDate && startDate.startsWith(month) && startDate !== `${month}-01`) {
    fileName = `g2b-notices-${month}-partial-from-${startDate.replaceAll("-", "")}.csv`;
    partialNote = `부분 데이터(${startDate}부터)`;
  }

  const lines = rows.map((row) =>
    [
      row.biz_no,
      row.biz_ord,
      row.title.trim(),
      categoryLabel(row.category),
      row.notice_inst,
      row.demand_inst,
      row.work_type,
      row.item_name,
      row.amount,
      row.notice_date,
      kst(row.close_at),
      g2bNoticeUrl(row.biz_no),
      SOURCE,
    ]
      .map(cell)
      .join(","),
  );

  // 엑셀에서 한글이 깨지지 않게 맨 앞에 BOM(﻿)을 붙인다
  const csv = "﻿" + [HEADER.map(cell).join(","), ...lines].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      // 화면이 "부분 데이터" 안내와 건수를 보여줄 수 있게 함께 보낸다
      "X-Row-Count": String(rows.length),
      "X-Partial-Note": encodeURIComponent(partialNote),
    },
  });
}
