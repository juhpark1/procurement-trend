// 사례 요약 주소 — 저장된 요약이 있으면 그대로, 없으면 만들어 저장한다
// Design Ref: §4 /api/notices/[id]/summary 규칙
//  · 실제로 있는 공고 id만 처리 (아무 번호로 비용을 일으키지 못하게)
//  · 같은 공고를 이미 만드는 중이면 새로 만들지 않고 "생성 중"을 돌려준다
import type { NextRequest } from "next/server";
import { db, type NoticeRow } from "@/lib/db";
import { summarizeNotice } from "@/lib/summarize";

// 요약 생성 중으로 보는 시간 (이 시간이 지나면 멈춘 것으로 보고 다시 만든다)
const IN_PROGRESS_MS = 30_000;

export const maxDuration = 30;

export async function GET(_request: NextRequest, context: RouteContext<"/api/notices/[id]/summary">) {
  const { id } = await context.params;
  const noticeId = Number(id);
  if (!Number.isInteger(noticeId) || noticeId <= 0) {
    return Response.json({ status: "failed", error: "잘못된 공고 번호입니다." }, { status: 400 });
  }

  const { data, error } = await db().from("notices").select("*").eq("id", noticeId).maybeSingle();
  if (error) return Response.json({ status: "failed", error: "공고 조회 실패" }, { status: 500 });
  const notice = data as NoticeRow | null;
  if (!notice) return Response.json({ status: "failed", error: "없는 공고입니다." }, { status: 404 });

  // 이미 만든 요약이 있으면 AI를 부르지 않는다
  if (notice.summary) return Response.json({ status: "done", summary: notice.summary });

  // 다른 요청이 만드는 중이면 기다리게 한다
  const staleBefore = new Date(Date.now() - IN_PROGRESS_MS).toISOString();
  const { data: claimed } = await db()
    .from("notices")
    .update({ summary_started_at: new Date().toISOString() })
    .eq("id", noticeId)
    .is("summary", null)
    .or(`summary_started_at.is.null,summary_started_at.lt.${staleBefore}`)
    .select("id");
  if (!claimed || claimed.length === 0) {
    return Response.json({ status: "pending" }, { status: 202 });
  }

  try {
    const summary = await summarizeNotice(notice);
    await db().from("notices").update({ summary }).eq("id", noticeId);
    return Response.json({ status: "done", summary });
  } catch {
    // 실패하면 저장하지 않고, 다음에 다시 만들 수 있게 표시를 지운다
    await db().from("notices").update({ summary_started_at: null }).eq("id", noticeId);
    return Response.json({ status: "failed" }, { status: 502 });
  }
}
