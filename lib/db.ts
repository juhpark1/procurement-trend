// Supabase 연결 — 서버 코드에서만 쓴다 (브라우저로 키가 가지 않게)
// Design Ref: §2.4 — 표 읽기·쓰기는 이 파일을 거친다.
// Design Ref: §7 — service role 키는 서버 실행용 비밀 값이며 NEXT_PUBLIC_ 이름을 쓰지 않는다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// 서버용 Supabase 클라이언트 (한 번 만들어 재사용)
export function db(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(".env에 SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.");
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

// notices 표 한 줄의 모양 (DESIGN.md §3.1)
export type NoticeRow = {
  id: number;
  biz_no: string;
  biz_ord: string;
  title: string;
  notice_inst: string;
  demand_inst: string;
  top_inst_code: string;
  work_type: string;
  item_name: string;
  industry: string;
  contract_method: string;
  contract_type: string;
  amount: number | null;
  notice_date: string;
  posted_at: string | null;
  open_at: string | null;
  close_at: string | null;
  ref_no: string;
  content_hash: string;
  category: string | null;
  summary: string | null;
  summary_started_at: string | null;
  first_seen_at: string;
  updated_at: string;
};

// runs 표 한 줄의 모양 (DESIGN.md §3.2)
export type RunRow = {
  id: number;
  kind: "main" | "retry" | "manual";
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "partial" | "failed" | "skipped";
  period_from: string | null;
  period_to: string | null;
  pages_total: number;
  pages_failed: number;
  fetched: number;
  kept: number;
  inserted: number;
  updated: number;
  classified: number;
  error: string | null;
};
