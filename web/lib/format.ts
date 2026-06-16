/* 포맷터 — 통화/숫자/퍼센트/날짜 한국식 표기 + 연월(YYYYMM) 라벨 */

export const F = {
  won(n: number | null): string {
    if (n == null) return "—";
    return "₩" + Math.round(n).toLocaleString("ko-KR");
  },
  wonShort(n: number | null): string {
    if (n == null) return "—";
    const m = n / 1_000_000; // 백만원 단위, 소수점 1자리 통일
    return m.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "백만";
  },
  num(n: number | null): string {
    return n == null ? "—" : Math.round(n).toLocaleString("ko-KR");
  },
  pct(x: number | null, d = 1): string {
    return x == null ? "—" : (x * 100).toFixed(d) + "%";
  },
  date(dt: Date | null): string {
    if (!dt) return "—";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  },
};

/** 202503 → "2025-03" */
export function ymLabel(ym: number): string {
  const s = String(ym);
  return s.slice(0, 4) + "-" + s.slice(4);
}

/** 202503 → "25.03" */
export function ymShort(ym: number): string {
  const s = String(ym);
  return s.slice(2, 4) + "." + s.slice(4);
}
