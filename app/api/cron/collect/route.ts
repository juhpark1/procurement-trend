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
