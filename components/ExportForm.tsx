"use client";

// [C] 월별 목록 내려받기: 연·월을 고르고 CSV 내려받기
// Design Ref: §5.1 [C], §5.4 ExportForm, §6 (빈 달 안내, 진행 중인 달 "부분 데이터")
import { useState } from "react";

type Props = {
  // 고를 수 있는 연도 (수집 시작 연도 ~ 올해)
  years: number[];
  defaultMonth: string;
};

export function ExportForm({ years, defaultMonth }: Props) {
  const [year, setYear] = useState(Number(defaultMonth.slice(0, 4)));
  const [month, setMonth] = useState(Number(defaultMonth.slice(5, 7)));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    const value = `${year}-${String(month).padStart(2, "0")}`;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/export?month=${value}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        setMessage(body.message ?? "내려받기에 실패했습니다.");
        return;
      }
      // 받은 파일을 브라우저 내려받기로 넘긴다
      const blob = await response.blob();
      const fileName =
        response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? `g2b-notices-${value}.csv`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);

      const count = response.headers.get("X-Row-Count");
      const partial = decodeURIComponent(response.headers.get("X-Partial-Note") ?? "");
      setMessage(`${count}건을 내려받았어요.${partial ? ` ${partial}` : ""}`);
    } catch {
      setMessage("내려받기에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const selectClass =
    "rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={year} onChange={(event) => setYear(Number(event.target.value))} aria-label="연도" className={selectClass}>
          {years.map((value) => (
            <option key={value} value={value}>
              {value}년
            </option>
          ))}
        </select>
        <select value={month} onChange={(event) => setMonth(Number(event.target.value))} aria-label="월" className={selectClass}>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {value}월
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="rounded-lg bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {busy ? "준비 중…" : "CSV 내려받기"}
        </button>
      </div>
      {message && <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>}
      <p className="text-xs text-zinc-500">
        엑셀에서 바로 열 수 있어요. 모든 줄에 공고번호·나라장터 링크·출처가 들어 있어요. &ldquo;SW 아님&rdquo; 공고는 빠져요.
      </p>
    </div>
  );
}
