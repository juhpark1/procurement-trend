// 예약 수집 주소 — Vercel Cron이 매일 부른다
// Design Ref: §4 /api/cron/collect — CRON_SECRET이 맞을 때만 실행한다.
// 사용 예 (개발 서버에서 첫 적재): Authorization 헤더에 CRON_SECRET을 넣고 /api/cron/collect?days=30
import type { NextRequest } from "next/server";
import { hasSuccessToday, runCollection } from "@/lib/collect";

// 첫 적재(30일, 약 150쪽)는 1분 넘게 걸릴 수 있어 넉넉히 둔다
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

  // 재시도 실행: 오늘 이미 성공했으면 아무것도 하지 않는다
  if (isRetry && (await hasSuccessToday())) {
    return Response.json({ ok: true, skipped: true, reason: "오늘 이미 수집에 성공했습니다." });
  }

  const result = await runCollection({ kind: isRetry ? "retry" : "main", days });
  return Response.json({ ok: result.status !== "failed", ...result }, { status: result.status === "failed" ? 502 : 200 });
}
