// AI 사례 요약 — 3문장, 200자 이내, 수집한 항목 값만 사용
// Design Ref: §4 /api/notices/[id]/summary 규칙 (15초 제한, 길이 넘으면 1번 다시, 그래도 넘으면 실패)
// CLAUDE.md 6) 사례 요약 규칙을 그대로 프롬프트에 넣는다.
import { ai, AI_MODEL } from "@/lib/ai";
import type { NoticeRow } from "@/lib/db";
import { formatAmount, formatKstDateTime } from "@/lib/format";

const TIME_LIMIT_MS = 15_000;
const MAX_LENGTH = 200;
const MAX_SENTENCES = 3;

const RULES = `너는 공공기관 입찰공고를 짧게 요약하는 도우미다. 아래 규칙을 반드시 지킨다.
- 3문장 이하, 200자 이내로 쓴다. 한국어 존댓말이 아닌 "~다"체로 쓴다.
- 들어갈 내용: 사업명으로 알 수 있는 사업 내용, 세부품명, 금액·공고일·마감일.
- 금액·날짜·기관명은 아래에 주어진 항목 값만 그대로 쓴다. 값이 "공고에 명시되지 않음"이면 그 문구를 그대로 쓴다.
- 사업명에 없는 과업 내용을 지어내지 않는다. 추측하거나 평가하지 않는다.
- 출처(공고번호·링크)는 쓰지 않는다. 화면이 따로 붙인다.`;

// 요약이 규칙(길이·문장 수)을 지켰는지
function isValidSummary(text: string): boolean {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.trim() !== "");
  return text.length > 0 && text.length <= MAX_LENGTH && sentences.length <= MAX_SENTENCES;
}

// AI에게 보낼 항목 값 (담당자 정보는 표에 없으므로 보내지 않는다)
function describe(notice: NoticeRow): string {
  const value = (text: string) => text.trim() || "공고에 명시되지 않음";
  return [
    `사업명: ${notice.title.trim()}`,
    `세부품명: ${value(notice.item_name)}`,
    `업종: ${value(notice.industry)}`,
    `공고기관: ${value(notice.notice_inst)}`,
    `수요기관: ${value(notice.demand_inst)}`,
    `추정가격(부가세 제외): ${formatAmount(notice.amount)}`,
    `공고일: ${notice.notice_date}`,
    `입찰 마감: ${notice.close_at ? formatKstDateTime(notice.close_at) : "공고에 명시되지 않음"}`,
  ].join("\n");
}

// 요약을 만든다. 규칙을 못 지키거나 15초를 넘기면 오류를 낸다.
export async function summarizeNotice(notice: NoticeRow): Promise<string> {
  const deadline = Date.now() + TIME_LIMIT_MS;

  // 길이·문장 수를 넘으면 1번 다시 만든다 (최대 2번 시도)
  for (let attempt = 1; attempt <= 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const response = await ai().chat.completions.create(
      {
        model: AI_MODEL,
        messages: [
          { role: "system", content: RULES },
          { role: "user", content: `다음 공고를 요약하라.\n${describe(notice)}` },
        ],
      },
      { signal: AbortSignal.timeout(remaining) },
    );

    const summary = (response.choices[0]?.message.content ?? "").trim();
    if (isValidSummary(summary)) return summary;
  }

  throw new Error("요약이 규칙(3문장·200자)을 지키지 못했거나 시간이 초과됐습니다.");
}
