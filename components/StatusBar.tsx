// 모든 화면 상단 상태 줄: 마지막 수집 · 수집 시작일 · 수집 대상 · 출처
// Design Ref: §5.1 상태 줄, §6 오류 처리 (일부 수집 실패 표시)
import { formatKstDateTime } from "@/lib/format";
import { TARGET_SCOPE_LABEL } from "@/lib/institutions";
import { getStatus } from "@/lib/queries";

export async function StatusBar() {
  const status = await getStatus();

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
      <span>
        마지막 수집: {formatKstDateTime(status.lastRun?.finished_at ?? null)}
        {status.lastRun?.status === "partial" && <span className="ml-1 text-amber-600">(일부 수집 실패)</span>}
      </span>
      {status.startDate && <span>{status.startDate}부터 수집한 데이터 기준</span>}
      <span>
        수집 대상: {TARGET_SCOPE_LABEL} {status.institutionCount}곳
      </span>
      <span>출처: 조달청 나라장터(URL정보제공서비스)</span>
    </div>
  );
}

// 상태 줄을 불러오는 동안 보이는 자리
export function StatusBarFallback() {
  return <div className="text-sm text-zinc-400">수집 정보를 불러오는 중…</div>;
}
