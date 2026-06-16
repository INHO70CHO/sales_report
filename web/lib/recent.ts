/* 최근 본 유통점 — localStorage 보관 (최대 8개) */
const KEY = "royal_recent";

export function getRecent(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const v = localStorage.getItem(KEY);
    return v ? JSON.parse(v) : [];
  } catch {
    return [];
  }
}

export function pushRecent(code: number) {
  try {
    const cur = getRecent();
    const next = [code, ...cur.filter((c) => c !== code)].slice(0, 8);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}
