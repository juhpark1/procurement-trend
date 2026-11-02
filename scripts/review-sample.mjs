// 분류 검수용 표본 100건을 CSV로 만든다 (PLAN 작업 9, 성공 기준 SC-3)
// 실행: npm run review:sample  →  review/classification-sample.csv 생성
// 엑셀로 열어 "사람 판단" 칸에 맞는 분야 이름을 적고, "일치" 칸에 O/X를 적는다.
// O의 개수가 85개 이상이면 SC-3(정확도 85% 이상) 통과.
// "SW 아님"으로 분류된 공고도 일부러 섞는다 (잘못 빠진 공고를 찾기 위해).
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";

const SAMPLE_SIZE = 100;

// lib/categories.ts와 같은 이름 (스크립트는 TypeScript 파일을 바로 읽지 못해 여기 다시 적음)
const LABELS = {
  genai: "생성형 AI·LLM",
  ai_service: "AI 응용 서비스",
  data: "데이터·분석",
  cloud: "클라우드·인프라",
  build: "정보시스템 구축",
  maintenance: "유지관리·운영",
  security: "정보보안",
  consulting: "ISP·컨설팅",
  etc: "기타(미분류)",
  non_sw: "SW 아님",
};

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(".env에 SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// Supabase는 한 번에 1,000줄까지만 주므로 나눠서 모두 읽는다
const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from("notice_latest")
    .select("biz_no, title, item_name, category")
    .not("category", "is", null)
    .range(from, from + 999);
  if (error) throw new Error(error.message);
  rows.push(...data);
  if (data.length < 1000) break;
}

// 무작위로 섞어 앞에서 100건
for (let i = rows.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [rows[i], rows[j]] = [rows[j], rows[i]];
}
const sample = rows.slice(0, SAMPLE_SIZE);

const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const header = ["번호", "공고번호", "사업명", "세부품명", "AI 분야", "사람 판단", "일치(O/X)"];
const lines = sample.map((row, index) =>
  [index + 1, row.biz_no, row.title.trim(), row.item_name, LABELS[row.category] ?? row.category, "", ""]
    .map(quote)
    .join(","),
);

mkdirSync("review", { recursive: true });
// 엑셀에서 한글이 깨지지 않게 맨 앞에 BOM을 붙인다
writeFileSync("review/classification-sample.csv", "﻿" + [header.map(quote).join(","), ...lines].join("\r\n"));

const counts = {};
for (const row of sample) counts[LABELS[row.category]] = (counts[LABELS[row.category]] ?? 0) + 1;
console.log(`전체 ${rows.length}건 중 ${sample.length}건을 review/classification-sample.csv에 저장했습니다.`);
console.log("표본의 분야별 건수:", counts);
