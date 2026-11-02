// 나라장터 URL정보제공서비스 호출 모듈
// Design Ref: §2.4 — 수집 로직은 lib/g2b.ts 한 곳에서만 나라장터를 호출한다.
// Design Ref: §3.1 — 화면·저장에 필요한 항목만 골라내고, 담당자 정보와 원본 응답 전체는 넘기지 않는다.

// URL정보제공서비스 화면이 내부에서 부르는 조회 주소 (공식 API가 아니라 형식이 바뀔 수 있음)
const SEARCH_URL = "https://www.g2b.go.kr/fi/fiu/fiua/UntySrch/srchTotal.do";

// 조회 화면이 함께 보내는 메뉴 정보 헤더 (URL정보제공서비스 화면 값 그대로)
const MENU_INFO = JSON.stringify({
  menuNo: "13674",
  menuCangVal: "FIUA006_01",
  bsneClsfCd: "%EC%97%85130020",
  scrnNo: "04536",
});

// 업무구분 코드: 일반용역(조070002), 기술용역(조070003)
const WORK_TYPE_CODES = "조070002 조070003";

// 이 서비스는 최근 1개월만 조회되므로 기본 조회 기간을 30일로 둔다
const DEFAULT_DAYS = 30;

// 조회 결과 한 줄에서 실제로 쓰는 항목만 적어 둔 타입
type RawRow = {
  bizNo?: string;
  bizOrd?: string;
  bizNm?: string;
  pbancInstUntyGrpNm?: string;
  dmstUntyGrpNm?: string;
  hghrkPbadmsStdInstCd?: string;
  prcmBsneAreaNm?: string;
  dtlsItemNm?: string;
  mindNm?: string;
  bidCtrtMthdNm?: string;
  ctrtTyNm?: string;
  bizYmd?: string;
  pbancPstgDt?: string;
  ldocNoVal?: string;
  // 추정가격(부가세 제외). 상세 화면의 "사업금액(추정가격+부가세)" ÷ 1.1 과 일치함을 확인
  pbancSrchItm03?: string;
  // 개찰 일시 (상세 화면의 "개찰" 일시와 일치)
  pbancSrchItm02?: string;
  // 입찰서 접수 마감 일시로 추정 (개찰 1시간 전 값으로 들어옴)
  pbancSrchItm08?: string;
};

type RawResponse = {
  dlSetParamM?: { totalSize?: number };
  dlTotalSrchL?: RawRow[];
};

// 우리 서비스에서 쓰는 공고 한 건의 모양 (DESIGN.md §3.1 notices 표와 같은 이름)
export type Notice = {
  bizNo: string;
  bizOrd: string;
  title: string;
  noticeInst: string;
  demandInst: string;
  topInstCode: string;
  workType: string;
  itemName: string;
  industry: string;
  contractMethod: string;
  contractType: string;
  amount: number | null;
  noticeDate: string;
  postedAt: string | null;
  openAt: string | null;
  closeAt: string | null;
  refNo: string;
};

// 응답에 꼭 있어야 하는 항목. 하나라도 없으면 형식이 바뀐 것으로 본다.
const REQUIRED_FIELDS = ["bizNo", "bizOrd", "bizNm", "bizYmd"] as const;

// 응답 형식이 예상과 다를 때 쓰는 오류 (CLAUDE.md §5: 조용히 넘기지 않고 실패로 기록)
export class G2bFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "G2bFormatError";
  }
}

export type FetchOptions = {
  // 비우면 기관 조건 없이 전체 기관의 공고를 받는다
  topInstCode?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export type FetchResult = {
  total: number;
  notices: Notice[];
};

// 한국 시간 기준 YYYYMMDD 문자열
function toKstYmd(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10).replaceAll("-", "");
}

// "20261027" → "2026-10-27"
function formatYmd(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

// "20261127100000" → "2026-11-27T10:00:00+09:00", 비어 있으면 null
function formatDateTime(value: string | undefined): string | null {
  if (!value || !/^\d{14}$/.test(value)) return null;
  return `${formatYmd(value)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}+09:00`;
}

// 나라장터는 괄호를 "&#40;" 같은 HTML 문자로 보내므로 원래 글자로 되돌린다
function decodeHtml(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"');
}

// 금액 문자열을 숫자로. 비어 있거나 0이면 "명시되지 않음"으로 보고 null
function toAmount(value: string | undefined): number | null {
  if (!value) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

// 조회 결과 한 줄을 Notice로 정리. 필요한 항목만 골라 담당자 정보 등은 자연히 빠진다.
export function toNotice(row: RawRow): Notice {
  const missing = REQUIRED_FIELDS.filter((key) => !row[key]);
  if (missing.length > 0) {
    throw new G2bFormatError(`필수 항목 없음: ${missing.join(", ")}`);
  }

  return {
    bizNo: row.bizNo!,
    bizOrd: row.bizOrd!,
    title: decodeHtml(row.bizNm),
    noticeInst: decodeHtml(row.pbancInstUntyGrpNm),
    demandInst: decodeHtml(row.dmstUntyGrpNm),
    topInstCode: row.hghrkPbadmsStdInstCd ?? "",
    workType: row.prcmBsneAreaNm ?? "",
    itemName: decodeHtml(row.dtlsItemNm),
    // 업종은 "#$"로 이어져 오므로 쉼표로 바꾼다
    industry: decodeHtml(row.mindNm).split("#$").filter(Boolean).join(", "),
    contractMethod: row.bidCtrtMthdNm ?? "",
    contractType: row.ctrtTyNm ?? "",
    amount: toAmount(row.pbancSrchItm03),
    noticeDate: formatYmd(row.bizYmd!),
    postedAt: formatDateTime(row.pbancPstgDt),
    openAt: formatDateTime(row.pbancSrchItm02),
    closeAt: formatDateTime(row.pbancSrchItm08),
    refNo: decodeHtml(row.ldocNoVal),
  };
}

// 최상위기관코드 하나로 입찰공고(일반용역·기술용역)를 조회한다
export async function fetchNotices(options: FetchOptions): Promise<FetchResult> {
  const to = options.to ?? new Date();
  const from = options.from ?? new Date(to.getTime() - DEFAULT_DAYS * 24 * 60 * 60 * 1000);

  const body = {
    dlSrchParamM: {
      currentPage: options.page ?? 1,
      recordCountPerPage: String(options.pageSize ?? 100),
      untySrchSeCd: "BK BUK",
      bizYmdDiv: "pstgDt",
      startBizYmd: toKstYmd(from),
      endBizYmd: toKstYmd(to),
      dmstUntyGrpNo: options.topInstCode ? `hghrkPbadmsStdInstCd:${options.topInstCode}` : "",
      dmstUntyGrpNm: options.topInstCode ? "전체" : "",
      prcmBsneAreaCd: WORK_TYPE_CODES,
      frcpYn: "N",
      laseYn: "N",
      rsrvYn: "N",
      cucUseYn: "N",
    },
  };

  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Accept: "application/json",
      "Menu-Info": MENU_INFO,
    },
    body: JSON.stringify(body),
    // 매번 최신 공고를 받아야 하므로 캐시하지 않는다
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`나라장터 응답 오류: HTTP ${response.status}`);
  }

  let data: RawResponse;
  try {
    data = (await response.json()) as RawResponse;
  } catch {
    throw new G2bFormatError("응답이 JSON 형식이 아님");
  }

  if (!Array.isArray(data.dlTotalSrchL) || typeof data.dlSetParamM?.totalSize !== "number") {
    throw new G2bFormatError("응답에 목록(dlTotalSrchL) 또는 전체 건수(totalSize)가 없음");
  }

  return {
    total: data.dlSetParamM.totalSize,
    notices: data.dlTotalSrchL.map(toNotice),
  };
}
