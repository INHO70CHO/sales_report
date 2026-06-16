/* ============================================================================
 * 유통점 현황조회 — 데이터 레이어 (실데이터)
 * ----------------------------------------------------------------------------
 * 소스: 영업실적-PRD용(260608).xlsx → Python ETL(etl/build_data.py)로 사전집계한 JSON
 *   /data/index.json        거래처 마스터 + 요약(검색/홈/조직)
 *   /data/dist/<코드>.json   거래처별 월별/품목/발주/보관품 (상세 진입 시 fetch)
 *
 * 월 1회 엑셀 교체 → `python etl/build_data.py` 재실행 → JSON 갱신. 화면 코드는 불변.
 * 원가성 정보(매출이익·공장단가)는 ETL 단계에서 제외되어 데이터에 없음.
 * ========================================================================== */
import { MONTHS, ymList } from "./months";

export interface IndexEntry {
  code: number;
  name: string;
  본부: string;
  사업부: string;
  팀: string;
  사원: string;
  region: string;
  sales6: number;   // 최근 6개월 판매액 합 (전체)
  s6du: number;     // 최근 6개월 유통 매출
  s6np: number;     // 최근 6개월 납품 매출
  days: number | null; // 마지막 발주 경과일
  gap: number | null;  // 평균 발주 간격
  lvl: "ok" | "watch" | "warn" | "none";
  spark: number[];  // 최근 6개월 월별 판매액
}

export interface IndexFile {
  ymMin: number;
  ymMax: number;
  asof: string;
  count: number;
  distributors: IndexEntry[];
}

export interface MonthlyRow { ym: number; sales: number; factory: number; qty: number; du: number; np: number; duf?: number; npf?: number; }
export interface ItemMonthly { ym: number; amount: number; qty: number; factory?: number; du?: number; np?: number; duf?: number; npf?: number; }
export interface ItemRow { 품번: string; 품명: string; 대분류: string; 시리즈: string; 단가: number; monthly: ItemMonthly[]; orders?: string[]; }
export interface InventoryRow { 품번: string; 품명: string; 대분류: string; 단가: number; 입고: number; 출고: number; 보관수량: number; 보관금액: number; }
export interface InvMonth { ym: number; amt: number; qty: number; cur?: number; }

export interface DistData {
  code: number;
  name: string;
  본부: string;
  사업부: string;
  팀: string;
  사원: string;
  region: string;
  asof: string;
  invYM: number | null;
  monthly: MonthlyRow[];
  items: ItemRow[];
  orders: string[]; // ISO "YYYY-MM-DD"
  inventory: InventoryRow[];
  invMonthly: InvMonth[]; // 월별 보관금액(YYYYMM)
  invByMonth: Record<string, InventoryRow[]>; // YYYYMM → 그 달 품목(보관금액 내림차순)
}

export interface SeriesPoint { ym: number; sales: number; factory: number; cum: number; qty: number; disc: number; cumDisc: number; du: number; np: number; duf: number; npf: number; }
export interface RankItem { 품번: string; 품명: string; 대분류: string; 시리즈: string; amount: number; qty: number; monthly: ItemMonthly[]; orders: string[]; }

export interface Aggregate {
  periodSales: number;
  cumSales: number;
  periodQty: number;
  cumQty: number;
  avgDisc: number;
  series: SeriesPoint[];
  ranking: RankItem[];
  orderDates: Date[];
  avgGap: number | null;
  lastOrder: Date | null;
  daysSince: number | null;
  prevPeriodSales: number | null;
}

/* ---------- fetch + 캐시 (+ 업로드 오버레이 병합) ---------- */
import { getOverlay, mergeDist, OverlayState } from "./overlay";

let _baseIndex: IndexFile | null = null;
let _mergedIndex: IndexFile | null = null;
const _distCache: Record<number, DistData> = {};

let _overlay: OverlayState | null = null;
let _overlayLoaded = false;
async function ensureOverlay(): Promise<OverlayState | null> {
  if (!_overlayLoaded) { _overlay = await getOverlay(); _overlayLoaded = true; }
  return _overlay;
}

async function fetchBaseIndex(): Promise<IndexFile> {
  if (_baseIndex) return _baseIndex;
  const r = await fetch("/data/index.json");
  if (!r.ok) throw new Error("index load failed");
  _baseIndex = (await r.json()) as IndexFile;
  return _baseIndex;
}

export async function fetchIndex(): Promise<IndexFile> {
  if (_mergedIndex) return _mergedIndex;
  const base = await fetchBaseIndex();
  const ov = await ensureOverlay();
  if (!ov || !ov.entries.length) { _mergedIndex = base; return base; }
  const map = new Map<number, IndexEntry>(base.distributors.map((d) => [d.code, d]));
  ov.entries.forEach((e) => map.set(e.code, e)); // 변경/신규 거래처 덮어쓰기
  const distributors = Array.from(map.values()).sort((a, b) => b.sales6 - a.sales6);
  _mergedIndex = { ...base, count: distributors.length, distributors };
  return _mergedIndex;
}

export function cachedIndex(): IndexFile | null {
  return _mergedIndex || _baseIndex;
}

async function fetchBaseDist(code: number): Promise<DistData | null> {
  const r = await fetch(`/data/dist/${code}.json`);
  if (!r.ok) return null;
  return (await r.json()) as DistData;
}

export async function fetchDist(code: number): Promise<DistData> {
  if (_distCache[code]) return _distCache[code];
  const ov = await ensureOverlay();
  const base = await fetchBaseDist(code);
  const ovDist = ov ? ov.dists[code] : undefined;
  if (!base && !ovDist) throw new Error("distributor not found");
  const merged = ovDist ? mergeDist(base, ovDist) : (base as DistData);
  _distCache[code] = merged;
  return merged;
}

/** 업로드 적용/초기화 후 캐시를 비워 다음 조회에 반영 */
export function invalidate(): void {
  _mergedIndex = null;
  _overlay = null;
  _overlayLoaded = false;
  for (const k of Object.keys(_distCache)) delete _distCache[Number(k)];
}

/* ---------- 검색 ---------- */
export function searchList(list: IndexEntry[], q: string): IndexEntry[] {
  if (!q || !q.trim()) return [];
  const s = q.trim().toLowerCase();
  return list.filter(
    (d) =>
      String(d.code).includes(s) ||
      d.name.toLowerCase().includes(s) ||
      (d.region || "").toLowerCase().includes(s) ||
      (d.사원 || "").toLowerCase().includes(s),
  );
}

/* ---------- 집계 ---------- */
function dayDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function prevPeriod(monthly: MonthlyRow[], startYM: number, endYM: number): number | null {
  const len = ymList(startYM, endYM).length;
  const startIdx = MONTHS.indexOf(startYM);
  if (startIdx <= 0) return null;
  const prevEndIdx = startIdx - 1;
  const prevStartIdx = Math.max(0, prevEndIdx - len + 1);
  const prevYMs = MONTHS.slice(prevStartIdx, prevEndIdx + 1);
  if (!prevYMs.length) return null;
  return monthly.filter((r) => prevYMs.includes(r.ym)).reduce((a, r) => a + r.sales, 0);
}

export function aggregate(dist: DistData, startYM: number, endYM: number): Aggregate {
  const monthly = dist.monthly;
  const rows = monthly.filter((r) => r.ym >= startYM && r.ym <= endYM);
  const periodSales = rows.reduce((a, r) => a + r.sales, 0);
  const periodFactory = rows.reduce((a, r) => a + r.factory, 0);
  const periodQty = rows.reduce((a, r) => a + r.qty, 0);
  const allUpto = monthly.filter((r) => r.ym <= endYM);
  const cumSales = allUpto.reduce((a, r) => a + r.sales, 0);
  const cumQty = allUpto.reduce((a, r) => a + r.qty, 0);
  const avgDisc = periodFactory > 0 ? (periodFactory - periodSales) / periodFactory : 0;

  let run = 0;
  let runFactory = 0;
  const series: SeriesPoint[] = rows.map((r) => {
    run += r.sales;
    runFactory += r.factory;
    const disc = r.factory > 0 ? (r.factory - r.sales) / r.factory : 0;
    const cumDisc = runFactory > 0 ? (runFactory - run) / runFactory : 0;
    return { ym: r.ym, sales: r.sales, factory: r.factory, cum: run, qty: r.qty, disc, cumDisc, du: r.du, np: r.np, duf: r.duf || 0, npf: r.npf || 0 };
  });

  const ranking: RankItem[] = dist.items
    .map((ir) => {
      const sub = ir.monthly.filter((m) => m.ym >= startYM && m.ym <= endYM);
      return {
        품번: ir.품번,
        품명: ir.품명,
        대분류: ir.대분류,
        시리즈: ir.시리즈,
        amount: sub.reduce((a, m) => a + m.amount, 0),
        qty: sub.reduce((a, m) => a + m.qty, 0),
        monthly: ir.monthly,
        orders: ir.orders || [],
      };
    })
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  // 발주: 기간 내 발주일 → 평균간격 / 마지막발주(전체) → 경과일
  const asof = new Date(dist.asof);
  const periodOrders = dist.orders
    .filter((iso) => {
      const ym = Number(iso.slice(0, 4)) * 100 + Number(iso.slice(5, 7));
      return ym >= startYM && ym <= endYM;
    })
    .map((iso) => new Date(iso));
  let avgGap: number | null = null;
  if (periodOrders.length >= 2) {
    let sum = 0;
    for (let i = 1; i < periodOrders.length; i++) sum += dayDiff(periodOrders[i - 1], periodOrders[i]);
    avgGap = Math.round(sum / (periodOrders.length - 1));
  }
  const lastIso = dist.orders.length ? dist.orders[dist.orders.length - 1] : null;
  const lastOrder = lastIso ? new Date(lastIso) : null;
  const daysSince = lastOrder ? dayDiff(lastOrder, asof) : null;

  return {
    periodSales,
    cumSales,
    periodQty,
    cumQty,
    avgDisc,
    series,
    ranking,
    orderDates: periodOrders,
    avgGap,
    lastOrder,
    daysSince,
    prevPeriodSales: prevPeriod(monthly, startYM, endYM),
  };
}
