// AI 분야 분류 — 분야가 비어 있는 공고를 골라 OpenAI로 분야 1개를 붙인다
// Design Ref: §2.2① 처리 5 — 근거는 사업명·세부품명만, 1회 실행 상한을 둔다.
// Plan SC: SC-3 분류 정확도 85% — 규칙은 CLAUDE.md 6)·PRD 5)를 그대로 프롬프트에 넣는다.
import { ai, AI_MODEL } from "@/lib/ai";
import { CATEGORIES, CATEGORY_CODES } from "@/lib/categories";
import { db } from "@/lib/db";

// 한 번에 AI에게 묶어 보내는 공고 수 (요청 수와 비용을 줄이기 위해)
const BATCH_SIZE = 25;

// 1회 실행에서 분류하는 기본 상한 (실행 시간 제한을 넘지 않게)
export const DEFAULT_CLASSIFY_LIMIT = 150;

const RULES = `너는 공공기관 입찰공고를 분야별로 나누는 분류기다. 아래 규칙을 반드시 지킨다.
- "SW 사업"이란 소프트웨어·정보시스템·데이터·AI·정보통신 인프라(서버·네트워크·클라우드)·정보보안과 관련된 사업이다.
  건물·시설·일반 장비의 설계·공사·점검·유지보수, 학술 연구·조사·교육·행사·홍보·시설 위탁운영처럼 정보화와 무관한 용역은 SW 사업이 아니다.
- 8개 분야는 모두 SW 사업 안에서의 분야다. 예를 들어 "컨설팅"은 정보화 컨설팅만, "유지관리"는 정보시스템 유지관리만 해당한다.
- 아래 목록의 code 중에서만 고른다. 목록 밖의 새 분야를 만들지 않는다.
- 공고 1건에 code를 1개만 붙인다.
- SW 사업인데 8개 분야 어디에도 분명히 들어맞지 않으면 "etc"(기타(미분류))로 둔다. 억지로 끼워 맞추지 않는다.
- SW 사업이 아닌 것이 분명할 때만 "non_sw"(SW 아님)로 둔다. 애매하면 "non_sw"가 아니라 "etc"로 둔다.
- 근거는 사업명과 세부품명에서만 찾는다. 기관 이름으로 추측하지 않는다.

분야 목록 (code: 이름 — 예시):
${CATEGORIES.map((category) => `- ${category.code}: ${category.label} — ${category.examples}`).join("\n")}`;

type PendingNotice = { id: number; title: string; item_name: string };

// 공고 묶음 하나를 분류해 { 공고 id: 분야 code } 를 돌려준다
async function classifyBatch(notices: PendingNotice[]): Promise<Map<number, string>> {
  // AI에게는 사업명·세부품명만 보낸다 (기관명·담당자 정보는 보내지 않음)
  const list = notices
    .map((notice, index) => `${index + 1}. 사업명: ${notice.title} / 세부품명: ${notice.item_name || "없음"}`)
    .join("\n");

  const response = await ai().chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: RULES },
      { role: "user", content: `다음 공고 ${notices.length}건을 분류해 번호(no)별 code를 답하라.\n${list}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "classification",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  no: { type: "integer" },
                  code: { type: "string", enum: CATEGORY_CODES },
                },
                required: ["no", "code"],
              },
            },
          },
          required: ["items"],
        },
      },
    },
  });

  const content = response.choices[0]?.message.content ?? "{}";
  const parsed = JSON.parse(content) as { items?: { no: number; code: string }[] };

  const result = new Map<number, string>();
  for (const item of parsed.items ?? []) {
    const notice = notices[item.no - 1];
    // 번호가 맞지 않거나 목록 밖 code면 버린다 (다음 실행에서 다시 분류됨)
    if (notice && CATEGORY_CODES.includes(item.code)) result.set(notice.id, item.code);
  }
  return result;
}

// 분야가 비어 있는 공고를 최신순으로 limit건까지 분류한다. 분류한 건수를 돌려준다.
export async function classifyPending(limit = DEFAULT_CLASSIFY_LIMIT): Promise<number> {
  const { data, error } = await db()
    .from("notices")
    .select("id, title, item_name")
    .is("category", null)
    .order("notice_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`분류 대상 조회 실패: ${error.message}`);

  const pending = (data ?? []) as PendingNotice[];
  let classified = 0;

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);
    let codes: Map<number, string>;
    try {
      codes = await classifyBatch(batch);
    } catch {
      // AI 오류는 이 묶음만 건너뛰고, 분야를 비워 둔 채 다음 실행에서 다시 시도한다
      continue;
    }

    // 같은 분야끼리 모아 한 번에 저장한다
    const byCode = new Map<string, number[]>();
    for (const [id, code] of codes) byCode.set(code, [...(byCode.get(code) ?? []), id]);
    for (const [code, ids] of byCode) {
      const { error: updateError } = await db()
        .from("notices")
        .update({ category: code, updated_at: new Date().toISOString() })
        .in("id", ids)
        .is("category", null);
      if (updateError) throw new Error(`분류 저장 실패: ${updateError.message}`);
      classified += ids.length;
    }
  }

  return classified;
}
