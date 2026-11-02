// OpenAI 연결 — 서버 코드에서만 쓴다
// Design Ref: §2.3 — 분류·요약에 OpenAI API를 쓴다.
import OpenAI from "openai";

// 사용할 모델. 비용이 낮은 소형 모델이며, 바꿀 때는 이 줄만 고친다.
export const AI_MODEL = "gpt-5.4-mini";

let client: OpenAI | null = null;

export function ai(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error(".env에 OPENAI_API_KEY가 없습니다.");
  client = new OpenAI({ apiKey });
  return client;
}
