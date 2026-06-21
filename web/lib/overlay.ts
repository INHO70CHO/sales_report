/* 업로드 오버레이 저장(IndexedDB) + 기본데이터와 upsert 병합
   "기존 유지 + 추가 실적 반영": 거래처+출고월 단위 덮어쓰기(겹치면 교체, 새 달/거래처/품목은 추가). */
import { DistData, IndexEntry, MonthlyRow, ItemRow, InvMonth } from "./data";
import { orderStatus } from "./util";

export interface OverlayState {
  asof: string;
  dists: Record<number, DistData>;
  entries: IndexEntry[]; // 적용 시점에 미리 계산해둔 인덱스 항목(변경 거래처)
  meta: { distCount: number; rowCount: number; ymMin: number | null; ymMax: number | null };
}

/* ---------- IndexedDB (대용량 대비, localStorage 5MB 한계 회피) ---------- */
const DB_NAME = "royal-overlay";
const STORE = "kv";
const KEY = "current";

function openDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function getOverlay(): Promise<OverlayState | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDB();
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      tx.onsuccess = () => res((tx.result as OverlayState) || null);
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    return null;
  }
}

export async function setOverlay(state: OverlayState): Promise<void> {
  const db = await openDB();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).put(state, KEY);
    tx.onsuccess = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function clearOverlay(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDB();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).delete(KEY);
    tx.onsuccess = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

/* ---------- 병합 (upsert) ---------- */
export function mergeDist(base: DistData | null, ov: DistData): DistData {
  if (!base) return ov;

  // 월별: ym키 맵, 오버레이로 덮어쓰기
  const mMap = new Map<number, MonthlyRow>();
  base.monthly.forEach((r) => mMap.set(r.ym, r));
  ov.monthly.forEach((r) => mMap.set(r.ym, r));
  const monthly = Array.from(mMap.values()).sort((a, b) => a.ym - b.ym);

  // 품목: 품번키 → 월별 ym키 덮어쓰기
  const iMap = new Map<string, ItemRow>();
  base.items.forEach((it) => iMap.set(it.품번, { ...it, monthly: it.monthly.slice() }));
  ov.items.forEach((ovIt) => {
    const cur = iMap.get(ovIt.품번);
    if (!cur) { iMap.set(ovIt.품번, { ...ovIt, monthly: ovIt.monthly.slice() }); return; }
    const m = new Map<number, { ym: number; amount: number; qty: number }>();
    cur.monthly.forEach((x) => m.set(x.ym, x));
    ovIt.monthly.forEach((x) => m.set(x.ym, x));
    iMap.set(ovIt.품번, {
      품번: ovIt.품번, 품명: ovIt.품명 || cur.품명, 대분류: ovIt.대분류 || cur.대분류,
      시리즈: ovIt.시리즈 || cur.시리즈, 단가: ovIt.단가 || cur.단가,
      monthly: Array.from(m.values()).sort((a, b) => a.ym - b.ym),
      orders: Array.from(new Set([...(cur.orders || []), ...(ovIt.orders || [])])).sort(),
    });
  });
  const items = Array.from(iMap.values()).sort(
    (a, b) => b.monthly.reduce((s, x) => s + x.amount, 0) - a.monthly.reduce((s, x) => s + x.amount, 0),
  );

  // 발주일: 합집합
  const orders = Array.from(new Set([...base.orders, ...ov.orders])).sort();

  // 보관품: 오버레이 보관월이 더 최신이면 교체
  let inventory = base.inventory, invYM = base.invYM, invDate = base.invDate;
  if (ov.invYM != null && (base.invYM == null || ov.invYM >= base.invYM)) {
    inventory = ov.inventory; invYM = ov.invYM; invDate = ov.invDate;
  }

  // 월별 보관금액: ym 단위 upsert
  const imMap = new Map<number, InvMonth>();
  (base.invMonthly || []).forEach((r) => imMap.set(r.ym, r));
  (ov.invMonthly || []).forEach((r) => imMap.set(r.ym, r));
  const invMonthly = Array.from(imMap.values()).sort((a, b) => a.ym - b.ym);
  const invByMonth = { ...(base.invByMonth || {}), ...(ov.invByMonth || {}) }; // ym키 upsert

  return {
    code: base.code,
    name: ov.name || base.name,
    본부: ov.본부 || base.본부, 사업부: ov.사업부 || base.사업부, 팀: ov.팀 || base.팀, 사원: ov.사원 || base.사원,
    region: ov.region || base.region,
    asof: ov.asof > base.asof ? ov.asof : base.asof,
    invYM, invDate, monthly, items, orders, inventory, invMonthly, invByMonth,
  };
}

/* 병합된 dist → 인덱스 요약 항목 (ETL index와 동일 계산) */
export function buildIndexEntry(dist: DistData): IndexEntry {
  const monthly = dist.monthly.slice().sort((a, b) => a.ym - b.ym);
  const last6 = monthly.slice(-6);
  const sales6 = last6.reduce((s, r) => s + r.sales, 0);
  const s6du = last6.reduce((s, r) => s + (r.du || 0), 0);
  const s6np = last6.reduce((s, r) => s + (r.np || 0), 0);
  const spark = last6.map((r) => r.sales);

  const orders = dist.orders.slice().sort();
  let gap: number | null = null;
  if (orders.length >= 2) {
    let sum = 0;
    for (let i = 1; i < orders.length; i++) {
      sum += (new Date(orders[i]).getTime() - new Date(orders[i - 1]).getTime()) / 86400000;
    }
    gap = Math.round(sum / (orders.length - 1));
  }
  const last = orders.length ? new Date(orders[orders.length - 1]) : null;
  const days = last ? Math.round((new Date(dist.asof).getTime() - last.getTime()) / 86400000) : null;

  return {
    code: dist.code, name: dist.name,
    본부: dist.본부, 사업부: dist.사업부, 팀: dist.팀, 사원: dist.사원, region: dist.region,
    sales6, s6du, s6np, days, gap, lvl: orderStatus(days, gap).level, spark,
  };
}
