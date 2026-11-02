"use client";

// 월별 막대 차트 (건수 / 금액 전환). 막대를 누르면 그 달의 공고 목록으로 이동
// Design Ref: §5.1 [A] 분야별 발주 추이, §5.4 TrendChart
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ChartPoint = {
  month: string;
  label: string;
  noticeCount: number;
  // 금액은 억 원 단위로 받는다 (차트 축을 읽기 쉽게)
  amountEok: number;
  partial: boolean;
};

type Props = {
  data: ChartPoint[];
  category: string;
  selectedMonth: string | null;
};

export function TrendChart({ data, category, selectedMonth }: Props) {
  const router = useRouter();
  const [metric, setMetric] = useState<"count" | "amount">("count");
  const dataKey = metric === "count" ? "noticeCount" : "amountEok";

  // 막대를 누르면 그 달 목록을 연다 (분야 선택은 유지)
  const openMonth = (month: string) => {
    router.push(`/?category=${category}&month=${month}#list`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 text-sm">
        {(
          [
            ["count", "건수"],
            ["amount", "금액(억 원)"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMetric(value)}
            className={`rounded-full border px-3 py-1 ${
              metric === value
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" />
            <YAxis allowDecimals={false} />
            <Tooltip
              formatter={(value) =>
                metric === "count" ? [`${value}건`, "건수"] : [`${Number(value).toLocaleString("ko-KR")}억 원`, "금액"]
              }
              labelFormatter={(label, payload) =>
                payload?.[0]?.payload?.partial ? `${label} (부분 데이터)` : String(label)
              }
            />
            <Bar dataKey={dataKey} cursor="pointer" onClick={(entry) => openMonth((entry as unknown as ChartPoint).month)}>
              {data.map((point) => (
                <Cell
                  key={point.month}
                  // 선택한 달은 진하게, 부분 데이터인 달은 흐리게
                  fill={point.month === selectedMonth ? "#1d4ed8" : point.partial ? "#93c5fd" : "#3b82f6"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-zinc-500">막대를 누르면 그 달의 공고 목록이 열려요. 옅은 막대는 부분 데이터예요.</p>
    </div>
  );
}
