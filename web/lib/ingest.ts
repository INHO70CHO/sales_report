/* 업로드 엑셀(동일 스키마) → 거래처별 오버레이 집계 (Python ETL 로직을 브라우저에서 재현)
   원가성 컬럼(매출이익·판매시점공장단가)은 읽지 않는다. */
import * as XLSX from "xlsx";
import { DistData, MonthlyRow, ItemRow, InventoryRow } from "./data";

export interface IngestResult {
  dists: DistData[];
  meta: { distCount: number; rowCount: number; ymMin: number | null; ymMax: number | null; invCount: number };
}

function num(v: any): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return isFinite(n) ? n : 0;
}
function str(v: any): string {
  return v == null ? "" : String(v).trim();
}
function cleanPn(s: string): string {
  return s.replace(/-N$/i, ""); // 신품번: 끝의 -N 제거
}
// 비데 재분류: 아래 베이스 품번(및 -MP·-EG 등 변형)은 대분류를 '비데'로
const BIDET_BASES = new Set(["RWC3500", "RWC2400", "RWC2500", "RWC2600", "RWC3600", "RWC7000", "RWC3100", "RWC3000"]);
function catFix(품번: string, 대분류: string): string {
  return BIDET_BASES.has(품번.split("-")[0].toUpperCase()) ? "비데" : 대분류;
}
function ymdToIso(n: number): string {
  const s = String(Math.trunc(n)).padStart(8, "0");
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export function ingestWorkbook(buf: ArrayBuffer): IngestResult {
  const wb = XLSX.read(buf, { type: "array" });
  const salesSheets = wb.SheetNames.filter((s) => s.includes("실적"));
  const invSheet = wb.SheetNames.find((s) => s.includes("보관"));

  // code -> 누적 구조
  type Acc = {
    name: string; 본부: string; 사업부: string; 팀: string; 사원: string;
    lastOrderNum: number; // 마스터(최신 출고일) 판정용
    monthly: Map<number, MonthlyRow>;
    items: Map<string, { meta: ItemRow; lastDay: number; m: Map<number, { amount: number; qty: number; factory: number; du: number; np: number; duf: number; npf: number }>; dset: Set<string> }>;
    orders: Set<string>;
  };
  const acc = new Map<number, Acc>();
  let rowCount = 0;
  let ymMin: number | null = null;
  let ymMax: number | null = null;

  for (const sh of salesSheets) {
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sh], { defval: null });
    for (const r of rows) {
      const code = num(r["거래처"]);
      if (!code) continue;
      const sales = num(r["판매액"]);
      const buRow = str(r["사업부"]);
      if (sales === 0 || buRow === "기타") continue; // 실적 0·사업부'기타' 제외
      const ym = num(r["출고월"]);
      const day = num(r["출고일"]);
      const 품번 = cleanPn(str(r["품번"]));
      const factory = num(r["판매시점공장도"]);
      const qty = num(r["수량"]);
      const gubun = str(r["구분2"]); // 유통/납품
      rowCount++;
      if (ym) { ymMin = ymMin == null ? ym : Math.min(ymMin, ym); ymMax = ymMax == null ? ym : Math.max(ymMax, ym); }

      let a = acc.get(code);
      if (!a) {
        a = { name: "", 본부: "", 사업부: "", 팀: "", 사원: "", lastOrderNum: 0, monthly: new Map(), items: new Map(), orders: new Set() };
        acc.set(code, a);
      }
      // 마스터: 최신 출고일 행
      if (day >= a.lastOrderNum) {
        a.lastOrderNum = day;
        a.name = str(r["거래처명"]) || a.name;
        a.본부 = str(r["본부"]) || a.본부;
        a.사업부 = str(r["사업부"]) || a.사업부;
        a.팀 = str(r["영업팀"]) || a.팀;
        a.사원 = str(r["영업사원"]) || a.사원;
      }
      // 월별 (+유통/납품 분리: 판매액 du/np, 공장도 duf/npf)
      if (ym) {
        const mr = a.monthly.get(ym) || { ym, sales: 0, factory: 0, qty: 0, du: 0, np: 0, duf: 0, npf: 0 };
        mr.sales += sales; mr.factory += factory; mr.qty += qty;
        if (gubun === "유통") { mr.du += sales; mr.duf += factory; }
        else if (gubun === "납품") { mr.np += sales; mr.npf += factory; }
        a.monthly.set(ym, mr);
      }
      // 품목
      if (품번 && ym) {
        let it = a.items.get(품번);
        if (!it) {
          it = { meta: { 품번, 품명: "", 대분류: "기타", 시리즈: "", 단가: 0, monthly: [] }, lastDay: 0, m: new Map(), dset: new Set() };
          a.items.set(품번, it);
        }
        if (day) it.dset.add(ymdToIso(day));
        if (day >= it.lastDay) {
          it.lastDay = day;
          it.meta.품명 = str(r["품명"]) || it.meta.품명;
          it.meta.대분류 = catFix(품번, str(r["대분류명"]) || it.meta.대분류);
          it.meta.시리즈 = str(r["시리즈명"]) || it.meta.시리즈;
          it.meta.단가 = num(r["단가"]) || it.meta.단가;
        }
        const im = it.m.get(ym) || { amount: 0, qty: 0, factory: 0, du: 0, np: 0, duf: 0, npf: 0 };
        im.amount += sales; im.qty += qty; im.factory += factory;
        if (gubun === "유통") { im.du += sales; im.duf += factory; }
        else if (gubun === "납품") { im.np += sales; im.npf += factory; }
        it.m.set(ym, im);
      }
      // 발주일
      if (day) a.orders.add(ymdToIso(day));
    }
  }

  // 보관품현황 (헤더 2행째 → range:1)
  const invByCode = new Map<number, { ym: number; rows: InventoryRow[] }>();
  const invMonByCode = new Map<number, Map<number, { amt: number; qty: number; cur: number; snap: number }>>(); // code → (YYYYMM → {amt,qty,cur(당월신규),snap(최종 보관월 YYMMDD)})
  const invItemByCode = new Map<number, Map<number, InventoryRow[]>>(); // code → (YYYYMM → 품목들)
  let invCount = 0;
  const toMon = (by: number) => (2000 + Math.trunc(by / 10000)) * 100 + (Math.trunc(by / 100) % 100); // YYMMDD → YYYYMM
  const yymmddToIso = (by: number) => { if (!by) return ""; const s = String(by).padStart(6, "0"); return `20${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`; }; // 보관월(YYMMDD) → 보관 조사일 ISO
  const ordIso = (od: number) => { if (!od || od <= 0) return ""; if (od >= 19000000) { const s = String(od); return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; } return yymmddToIso(od); }; // 주문작성일 → 보관 잡은 날 ISO
  let globalInvYm = 0; // 보관조사일 = 보관품현황 전체의 마지막 보관월(글로벌 최신)
  const gmonMax = new Map<number, number>(); // mon(YYYYMM) → 그 달 글로벌 최종 보관월(조사일). 0원 채우기용
  if (invSheet) {
    const irows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[invSheet], { range: 1, defval: null });
    // 1차: (거래처,월)별 최신 스냅샷 보관월 + 전체 최신(보관조사일) + 월별 글로벌 조사일
    const monMax = new Map<string, number>();
    for (const r of irows) {
      const code = num(r["거래처"]); const ym = num(r["보관월"]);
      if (!code) continue;
      globalInvYm = Math.max(globalInvYm, ym);
      const mon = toMon(ym);
      gmonMax.set(mon, Math.max(gmonMax.get(mon) || 0, ym));
      const k = code + "|" + mon;
      monMax.set(k, Math.max(monMax.get(k) || 0, ym));
    }
    // 월별 보관금액: 각 (거래처,월) 최신 스냅샷 합계
    for (const r of irows) {
      const code = num(r["거래처"]); const ym = num(r["보관월"]);
      if (!code) continue;
      const mon = toMon(ym);
      if (ym !== monMax.get(code + "|" + mon)) continue;
      let mm = invMonByCode.get(code);
      if (!mm) { mm = new Map(); invMonByCode.set(code, mm); }
      const e = mm.get(mon) || { amt: 0, qty: 0, cur: 0, snap: ym };
      e.amt += num(r["보관금액"]); e.qty += num(r["보관수량"]);
      e.snap = ym; // 이 월의 최종 보관월(필터로 ym===monMax 보장) = 보관 조사일
      const od = num(r["주문작성일"]); const omon = od >= 19000000 ? Math.trunc(od / 100) : toMon(od);
      if (omon === mon) e.cur += num(r["보관금액"]); // 당월 신규 보관(주문작성일 년월=보관월)
      mm.set(mon, e);
      // 월별 품목 내역
      let ii = invItemByCode.get(code);
      if (!ii) { ii = new Map(); invItemByCode.set(code, ii); }
      let arr = ii.get(mon);
      if (!arr) { arr = []; ii.set(mon, arr); }
      arr.push({
        품번: cleanPn(str(r["품번"])), 품명: str(r["품명"]), 대분류: catFix(cleanPn(str(r["품번"])), str(r["대분류"]) || "기타"),
        단가: num(r["단가"]), 입고: num(r["입고수량"]), 출고: num(r["출고수량"]),
        보관수량: num(r["보관수량"]), 보관금액: num(r["보관금액"]), 보관일: ordIso(num(r["주문작성일"])),
      });
    }
    // 현재 보관 현황 = 전체 마지막 보관월(보관조사일)에 잡힌 품목만. 그 날짜에 없는 거래처는 미표기.
    for (const r of irows) {
      const code = num(r["거래처"]); const ym = num(r["보관월"]);
      if (!code || ym !== globalInvYm) continue;
      let e = invByCode.get(code);
      if (!e) { e = { ym, rows: [] }; invByCode.set(code, e); }
      e.rows.push({
        품번: cleanPn(str(r["품번"])), 품명: str(r["품명"]), 대분류: catFix(cleanPn(str(r["품번"])), str(r["대분류"]) || "기타"),
        단가: num(r["단가"]), 입고: num(r["입고수량"]), 출고: num(r["출고수량"]),
        보관수량: num(r["보관수량"]), 보관금액: num(r["보관금액"]), 보관일: ordIso(num(r["주문작성일"])),
      });
      invCount++;
    }
  }

  const asof = new Date().toISOString().slice(0, 10);
  const dists: DistData[] = [];
  for (const [code, a] of acc) {
    const monthly = Array.from(a.monthly.values()).sort((x, y) => x.ym - y.ym);
    const items: ItemRow[] = Array.from(a.items.values())
      .map((it) => ({
        ...it.meta,
        monthly: Array.from(it.m.entries()).map(([ym, v]) => ({ ym, amount: v.amount, qty: v.qty, factory: v.factory, du: v.du, np: v.np, duf: v.duf, npf: v.npf })).sort((x, y) => x.ym - y.ym),
        orders: Array.from(it.dset).sort(),
      }))
      .sort((x, y) => y.monthly.reduce((s, m) => s + m.amount, 0) - x.monthly.reduce((s, m) => s + m.amount, 0));
    const orders = Array.from(a.orders).sort();
    const inv = invByCode.get(code);
    const mm = invMonByCode.get(code);
    // 전체 보관월에 대해 0원 채우기 (보관 없는 달도 보관월 표시·0원)
    const GLOBAL_MONTHS = Array.from(gmonMax.keys()).sort((a, b) => a - b);
    const invMonthly = mm
      ? GLOBAL_MONTHS.map((m) => {
          const v = mm.get(m);
          return v ? { ym: m, amt: v.amt, qty: v.qty, cur: v.cur, date: yymmddToIso(v.snap) }
                   : { ym: m, amt: 0, qty: 0, cur: 0, date: yymmddToIso(gmonMax.get(m) || 0) };
        })
      : [];
    const ii = invItemByCode.get(code);
    const invByMonth: Record<string, InventoryRow[]> = {};
    if (ii) for (const [mon, arr] of ii) invByMonth[String(mon)] = arr.slice().sort((x, y) => y.보관금액 - x.보관금액);
    dists.push({
      code, name: a.name, 본부: a.본부, 사업부: a.사업부, 팀: a.팀, 사원: a.사원,
      region: a.사업부, asof, invYM: inv ? inv.ym : null, invDate: inv ? yymmddToIso(inv.ym) : null,
      monthly, items, orders, inventory: inv ? inv.rows : [], invMonthly, invByMonth,
    });
  }

  return { dists, meta: { distCount: dists.length, rowCount, ymMin, ymMax, invCount } };
}
