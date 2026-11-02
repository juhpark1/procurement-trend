// 수집 대상 기관 판단
// Design Ref: §2.2① — 1차 수집 대상은 중앙부처(국가기관)이며, 대학은 뺀다.
//
// 공고마다 붙어 오는 최상위기관코드(행정표준기관코드 7자리)의 첫 자리로 기관 종류를 가린다.
// 2026-11-02 한 달치 전체 공고(14,766건)를 받아 확인한 결과:
//   - "1"로 시작: 중앙부처와 그 소속 기관 (예: 1230000 조달청, 1741000 행정안전부, 1290000 국방부) — 67곳
//   - "6"·"3"·"4"·"5"로 시작: 지자체, "7"·"8"·"9": 교육청 등, "B"·"Z": 공공기관·기타
// 그래서 기관코드 목록을 따로 들고 있지 않고, 전체를 받아 "1"로 시작하는 공고만 남긴다.
//
// 단, 교육부(1342000) 등의 코드 아래에는 국립·사립 대학 공고가 많이 섞여 있어 기관 이름으로 뺀다 (2026-11-02 사용자 결정).
// "학교"는 넣지 않는다 — 사관학교·중앙경찰학교 같은 부처 소속 교육기관은 남긴다.

// 수집 대상 범위 이름 (화면 상태 줄 표시용)
export const TARGET_SCOPE_LABEL = "중앙부처(대학 제외)";

// 대학으로 보는 기관 이름 (대학교·대학·산학협력단)
const UNIVERSITY_PATTERN = /(대학|산학협력단)/;

// 이 최상위기관코드가 중앙부처인지
export function isTargetInstitution(topInstCode: string): boolean {
  return /^1\d{6}$/.test(topInstCode);
}

// 공고기관·수요기관 이름이 대학인지
export function isUniversity(institutionName: string): boolean {
  return UNIVERSITY_PATTERN.test(institutionName);
}

// 이 공고를 수집 대상으로 저장할지 (중앙부처이고, 공고기관·수요기관 모두 대학이 아님)
export function isTargetNotice(notice: { topInstCode: string; noticeInst: string; demandInst: string }): boolean {
  return (
    isTargetInstitution(notice.topInstCode) && !isUniversity(notice.noticeInst) && !isUniversity(notice.demandInst)
  );
}
