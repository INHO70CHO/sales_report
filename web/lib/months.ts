/* 데이터 기간 상수 — ETL(build_data.py)이 자동 생성. 수동 편집 금지 */
export const YM_MIN = 202301;
export const YM_MAX = 202607;

export const MONTHS: number[] = (() => {
  const a: number[] = [];
  const y0 = Math.floor(YM_MIN / 100), y1 = Math.floor(YM_MAX / 100);
  for (let y = y0; y <= y1; y++) {
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
