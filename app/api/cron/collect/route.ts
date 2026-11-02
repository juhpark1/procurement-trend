// 예약 수집 주소 — Vercel Cron이 매일 부른다 (수집 → 분류)
// Design Ref: §4 /api/cron/collect — CRON_SECRET이 맞을 때만 실행한다.
// 사용 예 (개발 서버, Authorization 헤더에 CRON_SECRET 필요):
//   /api/cron/collect?days=30       첫 적재 (30일치)
//   /api/cron/collect?retry=1       재시도 (오늘 성공 기록이 있으면 건너뜀)
//   /api/cron/collect?classifyOnly=1  수집 없이 밀린 분류만 진행
import type { NextRequest } from "next/server";
import { hasSuccessToday, runCollection } from "@/lib/collect";
import { classifyPending, DEFAULT_CLASSIFY_LIMIT } from "@/lib/classify";
import { db } from "@/lib/db";

// 첫 적재(30일, 약 150쪽)와 분류를 함께 하면 1분이 넘을 수 있어 넉넉히 둔다
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "권한이 없습니다." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const isRetry = params.get("retry") === "1";
  // 기본은 최근 3일(매일 실행), 첫 적재 때만 days=30. 서비스가 1개월만 주므로 30일이 최대
  const days = Math.min(30, Math.max(1, Number(params.get("days") ?? 3) || 3));

  // 지난 기간 한 번만 받기: ?from=YYYY-MM-DD&to=YYYY-MM-DD (최대 31일, kind는 manual)
  // 매일 수집(최근 3일)과 같은 흐름이며, 같은 공고는 공고번호로 중복 없이 합쳐진다
  const fromParam = params.get("from");
  const toParam = params.get("to");
  if (fromParam || toParam) {
    const valid = (text: string | null) => text !== null && /^\d{4}-\d{2}-\d{2}$/.test(text);
    if (!valid(fromParam) || !valid(toParam)) {
      return Response.json({ ok: false, error: "from, to는 YYYY-MM-DD 형식으로 둘 다 필요합니다." }, { status: 400 });
    }
    // 날짜는 한국 시간 하루의 끝까지 포함하도록 정오로 맞춘다
    const from = new Date(`${fromParam}T12:00:00+09:00`);
    const to = new Date(`${toParam}T12:00:00+09:00`);
    const span = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (!(span >= 0 && span <= 31)) {
      return Response.json({ ok: false, error: "기간은 0~31일 사이여야 합니다." }, { status: 400 });
    }
    const result = await runCollection({ kind: "manual", days, range: { from, to } });
    return Response.json({ ok: result.status !== "failed", ...result }, { status: result.status === "failed" ? 502 : 200 });
  }

  // 밀린 분류만 진행 (첫 적재 뒤 여러 번 불러 2천여 건을 나눠 분류할 때)
  if (params.get("classifyOnly") === "1") {
    const classified = await classifyPending(DEFAULT_CLASSIFY_LIMIT);
    return Response.json({ ok: true, classified });
  }

  // 재시도 실행: 오늘 이미 성공했으면 아무것도 하지 않는다
  if (isRetry && (await hasSuccessToday())) {
    return Response.json({ ok: true, skipped: true, reason: "오늘 이미 수집에 성공했습니다." });
  }

  const result = await runCollection({ kind: isRetry ? "retry" : "main", days });

  // 수집 뒤 분야가 비어 있는 공고(새 공고·정정 공고)를 분류한다. 분류 실패는 수집 결과를 바꾸지 않는다.
  let classified = 0;
  let classifyError: string | null = null;
  try {
    classified = await classifyPending(DEFAULT_CLASSIFY_LIMIT);
    await db().from("runs").update({ classified }).eq("id", result.runId);
  } catch (error) {
    classifyError = error instanceof Error ? error.message : String(error);
  }

  return Response.json(
    { ok: result.status !== "failed", ...result, classified, classifyError },
    { status: result.status === "failed" ? 502 : 200 },
  );
}
