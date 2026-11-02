// PLAN 작업 1 확인용: 기관 1곳의 입찰공고를 서버 코드에서 받아 보는 주소
// 사용 예: /api/g2b/probe?inst=1230000 (기본값: 조달청). Authorization 헤더에 CRON_SECRET이 필요하다.
// Vercel 배포 뒤 해외 서버에서 나라장터 접속이 되는지 확인하는 용도다 (Part 5)
// Plan SC: 수집 가능 여부·받을 항목·금액 항목 의미·서버 위치(해외 접속 차단 여부)를 확인한다.
import type { NextRequest } from "next/server";
import { fetchNotices, G2bFormatError } from "@/lib/g2b";

// 요청 주소(inst)를 읽으므로 호출할 때마다 새로 실행된다 (cacheComponents 사용 중이라 dynamic 설정은 쓰지 않음)
export async function GET(request: NextRequest) {
  // 누구나 눌러 나라장터 호출을 일으키지 못하게, 수집 주소와 같은 비밀 값(CRON_SECRET)이 있어야 한다
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "권한이 없습니다." }, { status: 401 });
  }

  const inst = request.nextUrl.searchParams.get("inst") ?? "1230000";

  // 최상위기관코드는 숫자 7자리
  if (!/^\d{7}$/.test(inst)) {
    return Response.json(
      { ok: false, error: "inst는 7자리 숫자(최상위기관코드)여야 합니다." },
      { status: 400 },
    );
  }

  // Vercel에 배포되면 실행 지역(예: icn1)이 들어오고, 내 컴퓨터에서는 local로 표시
  const region = process.env.VERCEL_REGION ?? "local";
  const startedAt = Date.now();

  try {
    const { total, notices } = await fetchNotices({ topInstCode: inst, pageSize: 10 });
    return Response.json({
      ok: true,
      region,
      inst,
      elapsedMs: Date.now() - startedAt,
      total,
      received: notices.length,
      withAmount: notices.filter((notice) => notice.amount !== null).length,
      samples: notices.slice(0, 3),
    });
  } catch (error) {
    const kind = error instanceof G2bFormatError ? "형식 오류" : "호출 실패";
    return Response.json(
      {
        ok: false,
        region,
        inst,
        elapsedMs: Date.now() - startedAt,
        error: `${kind}: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 502 },
    );
  }
}
