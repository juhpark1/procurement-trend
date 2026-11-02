// 수집 흐름: 나라장터에서 받기 → 중앙부처만 남기기 → 중복 정리 → 저장 → 기록
// Design Ref: §2.2① 수집 흐름, §3.2 runs 표
// Plan SC: SC-5 자동 수집 안정성 — 실행마다 runs 표에 결과를 남긴다.
import { createHash } from "node:crypto";
import { fetchNotices, G2bFormatError, type Notice } from "@/lib/g2b";
import { isTargetNotice } from "@/lib/institutions";
import { db, type NoticeRow, type RunRow } from "@/lib/db";

const PAGE_SIZE = 100; // 나라장터가 한 번에 주는 최대 건수
const DAY_MS = 24 * 60 * 60 * 1000;

export type CollectOptions = {
  kind: RunRow["kind"];
  // 오늘부터 며칠 전까지 받을지 (첫 수집 30일, 매일 3일)
  days: number;
  // 지난 기간을 한 번만 따로 받을 때의 시작·끝 날짜 (둘 다 있으면 days보다 우선)
  range?: { from: Date; to: Date };
};

export type CollectResult = {
  runId: number;
  status: RunRow["status"];
  pagesTotal: number;
  pagesFailed: number;
  fetched: number;
  kept: number;
  inserted: number;
  updated: number;
  error: string | null;
};

// 내용 비교용 값 — 이 값이 바뀌면 정정 공고로 보고 분류·요약을 다시 만든다
function hashNotice(notice: Notice): string {
  return createHash("sha256").update(JSON.stringify(notice)).digest("hex").slice(0, 32);
}

// Notice → notices 표에 넣을 값 (분류·요약 칸은 따로 다룬다)
function toRow(notice: Notice) {
  return {
    biz_no: notice.bizNo,
    biz_ord: notice.bizOrd,
    title: notice.title,
    notice_inst: notice.noticeInst,
    demand_inst: notice.demandInst,
    top_inst_code: notice.topInstCode,
    work_type: notice.workType,
    item_name: notice.itemName,
    industry: notice.industry,
    contract_method: notice.contractMethod,
    contract_type: notice.contractType,
    amount: notice.amount,
    notice_date: notice.noticeDate,
    posted_at: notice.postedAt,
    open_at: notice.openAt,
    close_at: notice.closeAt,
    ref_no: notice.refNo,
    content_hash: hashNotice(notice),
  };
}

// 같은 사업번호가 여러 번 오면 차수가 가장 큰 것(최신)만 남긴다
function latestByBizNo(notices: Notice[]): Notice[] {
  const latest = new Map<string, Notice>();
  for (const notice of notices) {
    const current = latest.get(notice.bizNo);
    if (!current || notice.bizOrd > current.bizOrd) latest.set(notice.bizNo, notice);
  }
  return [...latest.values()];
}

// 나라장터에서 한 쪽을 받는다. 실패하면 1번 더 시도한다.
async function fetchPage(from: Date, to: Date, page: number) {
  try {
    return await fetchNotices({ from, to, page, pageSize: PAGE_SIZE });
  } catch {
    return await fetchNotices({ from, to, page, pageSize: PAGE_SIZE });
  }
}

// 받은 공고를 표에 저장한다. 새 공고는 넣고, 차수가 커졌거나 내용이 바뀐 공고는 고친다.
async function saveNotices(notices: Notice[]): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  // 한 번에 너무 많이 보내지 않도록 500건씩 나눈다
  for (let start = 0; start < notices.length; start += 500) {
    const chunk = notices.slice(start, start + 500);
    const { data: existing, error } = await db()
      .from("notices")
      .select("biz_no, biz_ord, content_hash")
      .in(
        "biz_no",
        chunk.map((notice) => notice.bizNo),
      );
    if (error) throw new Error(`기존 공고 조회 실패: ${error.message}`);

    const known = new Map(
      (existing as Pick<NoticeRow, "biz_no" | "biz_ord" | "content_hash">[]).map((row) => [row.biz_no, row]),
    );

    const toInsert = [];
    const toUpdate = [];
    for (const notice of chunk) {
      const row = toRow(notice);
      const before = known.get(notice.bizNo);
      if (!before) {
        toInsert.push(row);
      } else if (notice.bizOrd >= before.biz_ord && row.content_hash !== before.content_hash) {
        // 정정·재공고: 내용이 바뀌었으니 분류·요약을 비워 다시 만들게 한다
        toUpdate.push({
          ...row,
          category: null,
          summary: null,
          summary_started_at: null,
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await db().from("notices").insert(toInsert);
      if (insertError) throw new Error(`공고 저장 실패: ${insertError.message}`);
      inserted += toInsert.length;
    }
    if (toUpdate.length > 0) {
      const { error: updateError } = await db().from("notices").upsert(toUpdate, { onConflict: "biz_no" });
      if (updateError) throw new Error(`공고 갱신 실패: ${updateError.message}`);
      updated += toUpdate.length;
    }
  }

  return { inserted, updated };
}

// 수집 한 번 실행
export async function runCollection(options: CollectOptions): Promise<CollectResult> {
  const to = options.range?.to ?? new Date();
  const from = options.range?.from ?? new Date(to.getTime() - options.days * DAY_MS);

  const { data: run, error: runError } = await db()
    .from("runs")
    .insert({
      kind: options.kind,
      period_from: from.toISOString().slice(0, 10),
      period_to: to.toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (runError || !run) throw new Error(`수집 기록 시작 실패: ${runError?.message}`);

  const result: CollectResult = {
    runId: run.id,
    status: "running",
    pagesTotal: 0,
    pagesFailed: 0,
    fetched: 0,
    kept: 0,
    inserted: 0,
    updated: 0,
    error: null,
  };

  try {
    // 첫 쪽에서 전체 건수를 알아낸 뒤 나머지 쪽을 받는다
    const first = await fetchPage(from, to, 1);
    result.pagesTotal = Math.max(1, Math.ceil(first.total / PAGE_SIZE));
    const received: Notice[] = [...first.notices];
    const pageErrors: string[] = [];

    for (let page = 2; page <= result.pagesTotal; page++) {
      try {
        const next = await fetchPage(from, to, page);
        received.push(...next.notices);
      } catch (error) {
        // 형식이 바뀐 것(필수 항목 없음 등)은 일시적 장애가 아니므로 실행 전체를 실패로 기록한다
        // Design Ref: §2.2① 처리 2 — 필수 항목이 없으면 이번 실행은 "실패"
        if (error instanceof G2bFormatError) throw error;
        // 네트워크 오류 같은 일시적 실패는 그 쪽만 건너뛰고 "일부 실패"로 기록한다
        result.pagesFailed += 1;
        pageErrors.push(`${page}쪽: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    result.fetched = received.length;
    const targets = latestByBizNo(received.filter(isTargetNotice));
    result.kept = targets.length;

    const saved = await saveNotices(targets);
    result.inserted = saved.inserted;
    result.updated = saved.updated;

    // 실패한 쪽이 하나라도 있으면 "일부 실패"
    result.status = result.pagesFailed > 0 ? "partial" : "success";
    result.error = pageErrors.length > 0 ? pageErrors.slice(0, 5).join(" / ") : null;
  } catch (error) {
    result.status = "failed";
    result.error = error instanceof Error ? error.message : String(error);
  }

  await db()
    .from("runs")
    .update({
      finished_at: new Date().toISOString(),
      status: result.status,
      pages_total: result.pagesTotal,
      pages_failed: result.pagesFailed,
      fetched: result.fetched,
      kept: result.kept,
      inserted: result.inserted,
      updated: result.updated,
      error: result.error,
    })
    .eq("id", result.runId);

  return result;
}

// 오늘(한국 시간) 이미 성공한 수집이 있는지 — 재시도 실행에서 쓴다
export async function hasSuccessToday(): Promise<boolean> {
  const kstMidnight = new Date(Math.floor((Date.now() + 9 * 3600 * 1000) / DAY_MS) * DAY_MS - 9 * 3600 * 1000);
  const { count, error } = await db()
    .from("runs")
    .select("id", { count: "exact", head: true })
    .eq("status", "success")
    .gte("started_at", kstMidnight.toISOString());
  if (error) throw new Error(`수집 기록 조회 실패: ${error.message}`);
  return (count ?? 0) > 0;
}
