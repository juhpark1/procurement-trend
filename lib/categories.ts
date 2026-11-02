// 분야 목록 — 화면 표시 이름·저장 코드값·AI 분야 묶음 여부를 이 파일 한 곳에서 관리한다
// Design Ref: §3.1 category — notices 표에는 아래 code 값이 저장된다.
// PRD 5) Must 1 "분야 목록 (확정, 2026-11-02)"과 같은 내용이다.

export type Category = {
  // 저장 코드값 (영문, 바꾸지 않는다)
  code: string;
  // 화면에 보이는 이름
  label: string;
  // AI에게 설명할 때 쓰는 예시
  examples: string;
  // "AI 분야 모아 보기"에 포함되는지
  isAi: boolean;
  // 차트·검색·CSV에서 빼는지 ("SW 아님"만 true)
  excluded: boolean;
};

export const CATEGORIES: Category[] = [
  { code: "genai", label: "생성형 AI·LLM", examples: "생성형 AI 플랫폼, 거대언어모델(LLM) 도입·구축", isAi: true, excluded: false },
  { code: "ai_service", label: "AI 응용 서비스", examples: "AI 민원상담 챗봇, 영상·음성 인식, AI 기반 분석 서비스", isAi: true, excluded: false },
  { code: "data", label: "데이터·분석", examples: "빅데이터 플랫폼, 데이터 분석, 공공데이터 개방·품질관리", isAi: true, excluded: false },
  { code: "cloud", label: "클라우드·인프라", examples: "클라우드 전환, 서버·네트워크·전산장비 구축", isAi: false, excluded: false },
  { code: "build", label: "정보시스템 구축", examples: "신규 정보시스템·홈페이지 개발, 기능 고도화", isAi: false, excluded: false },
  { code: "maintenance", label: "유지관리·운영", examples: "정보시스템·홈페이지 유지보수, 정보시스템 운영 위탁 (일반 장비·시설 유지보수는 제외)", isAi: false, excluded: false },
  { code: "security", label: "정보보안", examples: "보안관제, 취약점 진단, 개인정보 보호 컨설팅", isAi: false, excluded: false },
  { code: "consulting", label: "ISP·컨설팅", examples: "정보화전략계획(ISP·ISMP), 정보화 PMO, 정보시스템 감리 (건설 설계·감리, 일반 연구용역은 제외)", isAi: false, excluded: false },
  { code: "etc", label: "기타(미분류)", examples: "SW 사업이지만 위 8개 분야에 분명히 들지 않음", isAi: false, excluded: false },
  { code: "non_sw", label: "SW 아님", examples: "건설사업관리, 설계·감리, 지반조사, 청소, 시설 안전점검, 경비, 일반 장비 유지보수, 연구·조사, 교육, 행사, 위탁관리 등 정보화와 무관한 용역", isAi: false, excluded: true },
];

// 코드값 목록 (AI 응답 검사용)
export const CATEGORY_CODES = CATEGORIES.map((category) => category.code);

// "AI 분야 모아 보기"에 들어가는 코드값
export const AI_CATEGORY_CODES = CATEGORIES.filter((category) => category.isAi).map((category) => category.code);

// 차트·검색·CSV에서 빼는 코드값
export const EXCLUDED_CATEGORY_CODES = CATEGORIES.filter((category) => category.excluded).map(
  (category) => category.code,
);

// 코드값 → 화면 이름. 분류 전(null)이면 "분류 중"
export function categoryLabel(code: string | null): string {
  if (!code) return "분류 중";
  return CATEGORIES.find((category) => category.code === code)?.label ?? "분류 중";
}
