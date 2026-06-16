/* 데이터 기간 상수 (2023-01 ~ 2026-05) — 데이터 소스와 분리해 기간 선택기 등에서 사용 */
export const YM_MIN = 202301;
export const YM_MAX = 202605;

export const MONTHS: number[] = (() => {
  const a: number[] = [];
  for (let y = 2023; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      const ym = y * 100 + m;
      if (ym < YM_MIN || ym > YM_MAX) continue;
      a.push(ym);
    }
  }
  return a;
})();

export function ymList(startYM: number, endYM: number): number[] {
  return MONTHS.filter((m) => m >= startYM && m <= endYM);
}
