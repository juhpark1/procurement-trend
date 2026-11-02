// 화면 표시용 형식 맞추기 (금액·날짜)

// 원 단위 금액 → "1,234억 원" / "5,600만 원" / "공고에 명시되지 않음"
export function formatAmount(amount: number | null): string {
  if (amount === null || amount <= 0) return "공고에 명시되지 않음";
  if (amount >= 100_000_000) return `${Math.round(amount / 100_000_000).toLocaleString("ko-KR")}억 원`;
  return `${Math.round(amount / 10_000).toLocaleString("ko-KR")}만 원`;
}

// ISO 일시 → 한국 시간 "YYYY-MM-DD HH:MM"
export function formatKstDateTime(iso: string | null): string {
  if (!iso) return "-";
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16).replace("T", " ");
}

// "2026-10" → "2026년 10월"
export function formatMonth(month: string): string {
  const [year, mon] = month.split("-");
  return `${year}년 ${Number(mon)}월`;
}

// 오늘(한국 시간) "YYYY-MM"
export function currentKstMonth(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}
