/* 공용 유틸 — 클래스 결합 + 발주 공백 상태 계산 */

export function cx(...args: any[]): string {
  return args.filter(Boolean).join(" ");
}

/** ISO 날짜 목록(정렬 가정)의 평균 간격(일). 2건 미만이면 null */
export function avgIntervalDays(dates: string[]): number | null {
  if (!dates || dates.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < dates.length; i++) {
    sum += (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000;
  }
  return Math.round(sum / (dates.length - 1));
}

export type OrderLevel = "ok" | "watch" | "warn" | "none";

/** 발주 공백 경고 계산 — 마지막 발주 경과일(daysSince)과 평균 간격(avgGap) 기준 */
export function orderStatus(
  daysSince: number | null,
  avgGap: number | null,
): { level: OrderLevel; text: string } {
  if (daysSince == null) return { level: "none", text: "발주 이력 없음" };
  const t = avgGap ? avgGap * 2 : 30;
  if (daysSince > Math.max(30, t)) return { level: "warn", text: "발주 공백 주의" };
  if (daysSince > (avgGap || 15)) return { level: "watch", text: "발주 간격 초과" };
  return { level: "ok", text: "정상 발주 중" };
}
