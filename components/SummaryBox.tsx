"use client";

// AI 요약 표시 — 저장된 요약이 없으면 요약 주소를 불러 만들고, 실패하면 안내 문구를 보여준다
// Design Ref: §5.4 SummaryBox, §6 (AI 요약 실패·지연)
import { useEffect, useState } from "react";

type Props = {
  noticeId: number;
  initialSummary: string | null;
  sourceUrl: string;
};

type State = { status: "loading" } | { status: "done"; summary: string } | { status: "failed" };

// "생성 중" 응답을 받으면 2초마다 다시 묻는다 (최대 10번)
const POLL_MS = 2_000;
const MAX_POLLS = 10;

export function SummaryBox({ noticeId, initialSummary, sourceUrl }: Props) {
  const [state, setState] = useState<State>(
    initialSummary ? { status: "done", summary: initialSummary } : { status: "loading" },
  );

  useEffect(() => {
    if (initialSummary) return;
    let cancelled = false;

    const load = async (poll: number) => {
      try {
        const response = await fetch(`/api/notices/${noticeId}/summary`);
        const body = (await response.json()) as { status: string; summary?: string };
        if (cancelled) return;
        if (body.status === "done" && body.summary) {
          setState({ status: "done", summary: body.summary });
        } else if (body.status === "pending" && poll < MAX_POLLS) {
          setTimeout(() => load(poll + 1), POLL_MS);
        } else {
          setState({ status: "failed" });
        }
      } catch {
        if (!cancelled) setState({ status: "failed" });
      }
    };

    load(0);
    return () => {
      cancelled = true;
    };
  }, [noticeId, initialSummary]);

  if (state.status === "loading") {
    return <p className="text-sm text-zinc-400">AI가 요약을 만드는 중이에요… (최대 15초)</p>;
  }

  if (state.status === "failed") {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        요약을 만들 수 없습니다. 원문을 확인해 주세요.{" "}
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
          원문 보기 ↗
        </a>
      </p>
    );
  }

  return <p className="leading-7">{state.summary}</p>;
}
