"use client";
/* 유통점 상세 탭 본문 — 판매실적 · 주요품목 · 판매주기 · 보관품 · 할인율 */
import React, { useEffect, useMemo, useState } from "react";
import { cx, orderStatus, avgIntervalDays } from "@/lib/util";
import { Aggregate, InvMonth, ItemRow } from "@/lib/data";
import { F, ymLabel } from "@/lib/format";
import { LineChart, Donut, MultiLineChart } from "@/components/charts";
import { Chips, Skeleton } from "@/components/ui";
import { IconChevron } from "@/components/icons";

/* 분류 표시 순서 + 색상 (수전금구·전략제품·도기·비데·사입·부품, 그 외 기타) */
const CAT_ORDER = ["수전금구", "전략제품", "도기", "비데", "사입", "부품"];
const catRank = (c: string) => { const i = CAT_ORDER.indexOf(c); return i < 0 ? CAT_ORDER.length : i; };
const CAT_COLORS: Record<string, string> = {
  "수전금구": "#1E40AF", "전략제품": "#0E7C66", "도기": "#D97706",
  "비데": "#7C3AED", "사입": "#DC2626", "부품": "#64748B", "기타": "#94A3B8",
};
const catOf = (c: string) => (CAT_ORDER.includes(c) ? c : "기타");

export function EmptyPeriod({ text }: { text?: string }) {
  return (
    <div className="empty">
      <div className="empty-ic">◷</div>
      <p>{text || "선택한 기간에 거래 내역이 없습니다"}</p>
      <span>기간을 다시 선택해 보세요</span>
    </div>
  );
}

/* 1. 판매실적 */
export function TabSales({ agg, items }: { agg: Aggregate; items: ItemRow[] }) {
  const [selYm, setSelYm] = useState<number | null>(null);
  const [donutCh, setDonutCh] = useState("전체"); // 전체/유통/납품
  useEffect(() => { setSelYm(agg.series.length ? agg.series[agg.series.length - 1].ym : null); }, [agg]);
  if (!agg.series.length) return <EmptyPeriod />;

  // 선택 월·채널의 분류별 순액(양수+반품 합산). 합계 = 월 판매액(또는 유통/납품)과 일치
  const chKey = donutCh === "유통" ? "du" : donutCh === "납품" ? "np" : "amount";
  const donutMap = new Map<string, number>();
  if (selYm != null) {
    items.forEach((it) => {
      const mm = it.monthly.find((m) => m.ym === selYm);
      if (mm) { const c = catOf(it.대분류); donutMap.set(c, (donutMap.get(c) || 0) + (((mm as any)[chKey]) || 0)); }
    });
  }
  const allCats = [...CAT_ORDER, "기타"];
  const donutItems = allCats.filter((c) => (donutMap.get(c) || 0) > 0).map((c) => ({ label: c, value: donutMap.get(c) as number, color: CAT_COLORS[c] }));
  const donutReturns = allCats.reduce((s, c) => { const v = donutMap.get(c) || 0; return v < 0 ? s + v : s; }, 0);
  const donutCenter = allCats.reduce((s, c) => s + (donutMap.get(c) || 0), 0); // 순 합계

  return (
    <div className="tabbody">
      <div className="card">
        <div className="card-head">
          <h3>월별 판매액</h3>
          <span className="legend muted">월 선택 시 분류 구성</span>
        </div>
        <LineChart data={agg.series} valueKey="sales" color="navy" height={170}
          fmt={(v) => F.wonShort(v)} sublines={[{ label: "유통", key: "du" }, { label: "납품", key: "np" }]}
          onSelect={(i) => setSelYm(agg.series[i].ym)} />
      </div>

      {selYm != null && (
        <div className="card">
          <div className="card-head"><h3>{ymLabel(selYm)} 분류별 구성</h3><span className="legend muted">{donutCh} 기준</span></div>
          <Chips options={["전체", "유통", "납품"]} value={donutCh} onChange={setDonutCh} />
          {donutItems.length ? <Donut items={donutItems} centerTotal={donutCenter} returns={donutReturns} /> : <div className="chart-empty" style={{ height: 80 }}>해당 월 판매 없음</div>}
        </div>
      )}
      <div className="card pad0">
        <table className="dtable eqcols">
          <thead><tr><th>출고월</th><th className="num">판매액</th><th className="num">유통</th><th className="num">납품</th></tr></thead>
          <tbody>
            {agg.series.slice().reverse().map((r) => (
              <tr key={r.ym} className={cx("row-link", r.ym === selYm && "row-sel")} onClick={() => setSelYm(r.ym)}>
                <td>{ymLabel(r.ym)}</td>
                <td className="num">{F.wonShort(r.sales)}</td>
                <td className="num muted">{F.wonShort(r.du)}</td>
                <td className="num muted">{F.wonShort(r.np)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* 2. 주요품목 */
export function TabItems({ agg, startYM, endYM, onOpenItem, cat, onCat }: { agg: Aggregate; startYM: number; endYM: number; onOpenItem: (품번: string) => void; cat: string; onCat: (c: string) => void }) {
  const [visible, setVisible] = useState(15);
  useEffect(() => { setVisible(15); }, [cat]);
  const list = useMemo(() => {
    const base = cat === "전체" ? agg.ranking : agg.ranking.filter((r) => r.대분류 === cat);
    if (cat !== "전체") return base; // 단일 분류는 매출순 유지
    return base.slice().sort((a, b) => (catRank(a.대분류) - catRank(b.대분류)) || (b.amount - a.amount));
  }, [agg, cat]);
  const cats = ["전체", ...Array.from(new Set(agg.ranking.map((r) => r.대분류)))
    .sort((a, b) => (catRank(a) - catRank(b)) || a.localeCompare(b, "ko"))];
  const max = list.length ? Math.max(...list.map((r) => r.amount)) : 1;
  if (!agg.ranking.length) return <EmptyPeriod />;
  const shown = list.slice(0, visible);
  const itemGap = (r: typeof shown[number]) =>
    avgIntervalDays((r.orders || []).filter((iso) => {
      const ym = Number(iso.slice(0, 4)) * 100 + Number(iso.slice(5, 7));
      return ym >= startYM && ym <= endYM;
    }));
  return (
    <div className="tabbody">
      <Chips options={cats} value={cat} onChange={onCat} />
      <div className="card pad0">
        {shown.map((r, i) => {
          const gap = itemGap(r);
          return (
          <button key={r.품번} className="rankrow" onClick={() => onOpenItem(r.품번)}>
            <span className="rank-no">{i + 1}</span>
            <span className="rank-main">
              <span className="rank-name">{r.품번}</span>
              <span className="rank-meta"><span className="tag">{r.대분류}</span>{r.품명}<span className="rank-cyc">주문주기 {gap != null ? `${gap}일` : "—"}</span></span>
              <span className="rank-bar"><i style={{ width: `${(r.amount / max) * 100}%` }} /></span>
            </span>
            <span className="rank-right">
              <span className="rank-vals">
                <span className="rank-amt">{F.wonShort(r.amount)}</span>
                <span className="rank-qty">{F.num(r.qty)}개</span>
              </span>
              <IconChevron className="ic-sm" />
            </span>
          </button>
          );
        })}
      </div>
      {list.length > visible && (
        <button className="more-btn" onClick={() => setVisible((v) => v + 15)}>
          더보기 (+15) · 남은 {list.length - visible}개
        </button>
      )}
    </div>
  );
}

/* 3. 판매주기 */
export function TabCycle({ agg }: { agg: Aggregate }) {
  const st = orderStatus(agg.daysSince, agg.avgGap);
  const recent = agg.orderDates.slice(-9);
  if (!agg.orderDates.length) return <EmptyPeriod text="선택 기간에 발주(거래) 내역이 없습니다" />;
  const gaps: number[] = [];
  for (let i = 1; i < recent.length; i++) gaps.push(Math.round((recent[i].getTime() - recent[i - 1].getTime()) / 86400000));
  return (
    <div className="tabbody">
      <div className="cycle-kpis">
        <div className="card cyc">
          <div className="cyc-cap">평균 발주 간격</div>
          <div className="cyc-big">{agg.avgGap != null ? agg.avgGap : "—"}<small>일</small></div>
          <div className="cyc-sub">기간 내 {agg.orderDates.length}회 발주</div>
        </div>
        <div className={cx("card cyc", st.level === "warn" && "cyc-warn", st.level === "watch" && "cyc-watch")}>
          <div className="cyc-cap">마지막 발주</div>
          <div className="cyc-big">{agg.daysSince != null ? agg.daysSince : "—"}<small>일 전</small></div>
          <div className={cx("cyc-status", "st-" + st.level)}>{st.level === "warn" ? "⚠ " : ""}{st.text} · {F.date(agg.lastOrder)}</div>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h3>최근 발주 타임라인</h3></div>
        <div className="timeline">
          {recent.map((d, i) => (
            <div className="tl-node" key={i}>
              {i > 0 && <span className="tl-gap">{gaps[i - 1]}일</span>}
              <span className="tl-dot" />
              <span className="tl-date">{String(d.getMonth() + 1).padStart(2, "0")}/{String(d.getDate()).padStart(2, "0")}</span>
            </div>
          ))}
          <div className="tl-node tl-now">
            <span className="tl-gap">{agg.daysSince}일</span>
            <span className="tl-dot tl-dot-now" />
            <span className="tl-date">오늘</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 4. 보관품 — 월별 보관금액 (월 선택 시 그 달 품목 상세로) */
export function TabInventory({ invMonthly, startYM, endYM, onOpenInvMonth }: {
  invMonthly: InvMonth[]; startYM: number; endYM: number; onOpenInvMonth: (ym: number) => void;
}) {
  const rows = (invMonthly || []).filter((m) => m.ym >= startYM && m.ym <= endYM);
  if (!rows.length) return <EmptyPeriod text="선택 기간에 보관품 내역이 없습니다" />;
  const invLines = [
    { key: "amt", label: "보관 총액", color: "#1E40AF", emph: true },
    { key: "cur", label: "당월 신규", color: "#D97706" },
  ];
  return (
    <div className="tabbody">
      <div className="card">
        <div className="card-head"><h3>월별 보관금액</h3><span className="legend muted">총액 · 당월 신규</span></div>
        <MultiLineChart data={rows} lines={invLines} height={190} fmt={(v) => F.wonShort(v)} yfmt={(v) => F.wonShort(v)} onPointClick={(i) => onOpenInvMonth(rows[i].ym)} />
      </div>
      <div className="card pad0">
        <table className="dtable">
          <thead><tr><th>보관월</th><th className="num">보관금액</th><th className="num">당월 신규</th><th className="num">보관수량</th><th></th></tr></thead>
          <tbody>
            {rows.slice().reverse().map((r) => (
              <tr key={r.ym} className="row-link" onClick={() => onOpenInvMonth(r.ym)}>
                <td>{ymLabel(r.ym)}</td>
                <td className="num">{F.wonShort(r.amt)}</td>
                <td className="num amber-txt">{F.wonShort(r.cur || 0)}</td>
                <td className="num muted">{F.num(r.qty)}개</td>
                <td className="num"><IconChevron className="ic-sm" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">보관월 말 스냅샷 기준 · <b>당월 신규</b>=주문작성일 년월이 해당 보관월인 금액 · 월 선택 시 품목별 상세. 원가성 정보는 표시되지 않습니다.</p>
    </div>
  );
}

/* 5. 할인율 — 그래프(전체/유통/납품 3선) + 채널 토글로 보는 출고월×제품군 매트릭스 */
const disc = (factory: number, sales: number) => (factory > 0 ? (factory - sales) / factory : 0);
const SHORT: Record<string, string> = { "수전금구": "수전", "전략제품": "전략", "도기": "도기", "비데": "비데", "사입": "사입", "부품": "부품" };

export function TabDiscount({ agg, items, startYM, endYM }: { agg: Aggregate; items: ItemRow[]; startYM: number; endYM: number }) {
  const [ch, setCh] = useState("전체");
  const [popup, setPopup] = useState<any>(null); // 음수 할인율 설명 팝업
  if (!agg.series.length) return <EmptyPeriod />;

  // 그래프: 전체/유통/납품 월 할인율 3선
  const chartData = agg.series.map((r) => ({
    ym: r.ym,
    전체: disc(r.factory, r.sales),
    유통: disc(r.duf || 0, r.du),
    납품: disc(r.npf || 0, r.np),
  }));
  const lines = [
    { key: "전체", label: "전체 할인율", color: "#1E40AF", emph: true },
    { key: "유통", label: "유통", color: "#0E7C66" },
    { key: "납품", label: "납품", color: "#D97706" },
  ];

  // 하단 매트릭스: 출고월 × 제품군, 선택 채널 기준
  const fkey = ch === "유통" ? "duf" : ch === "납품" ? "npf" : "factory";
  const skey = ch === "유통" ? "du" : ch === "납품" ? "np" : "amount";
  const sfkey = ch === "유통" ? "duf" : ch === "납품" ? "npf" : "factory";
  const sskey = ch === "유통" ? "du" : ch === "납품" ? "np" : "sales";
  // cat -> ym -> {f,s}
  const cm = new Map<string, Map<number, { f: number; s: number }>>();
  items.forEach((it) => {
    const c = catOf(it.대분류);
    if (!CAT_ORDER.includes(c)) return;
    let mm = cm.get(c); if (!mm) { mm = new Map(); cm.set(c, mm); }
    it.monthly.forEach((m) => {
      if (m.ym >= startYM && m.ym <= endYM) {
        const e = mm!.get(m.ym) || { f: 0, s: 0 };
        e.f += ((m as any)[fkey]) || 0; e.s += ((m as any)[skey]) || 0;
        mm!.set(m.ym, e);
      }
    });
  });
  const rows = agg.series.slice().reverse().map((r) => ({
    ym: r.ym,
    전체: disc((r as any)[sfkey] || 0, (r as any)[sskey] || 0),
    cats: CAT_ORDER.map((c) => { const e = cm.get(c)?.get(r.ym); return e ? disc(e.f, e.s) : null; }),
  }));

  return (
    <div className="tabbody">
      <div className="card">
        <div className="card-head"><h3>월별 할인율 추이</h3><span className="legend muted">음수월 선택 시 설명</span></div>
        <MultiLineChart data={chartData} lines={lines} height={180} onPointClick={(i) => {
          const s = agg.series[i];
          const a = disc(s.factory, s.sales), du = disc(s.duf || 0, s.du), np = disc((s as any).npf || 0, s.np);
          if (a < 0 || du < 0 || np < 0) {
            // 음수 유발 품번: 해당 월 판매액 > 공장도 (공장도보다 비싸게 판매)
            const negItems = items.map((it) => {
              const m = it.monthly.find((x) => x.ym === s.ym);
              if (!m) return null;
              const f = m.factory || 0, am = m.amount;
              if (am <= f) return null;
              return { 품번: it.품번, 품명: it.품명, a: am, f, d: f > 0 ? (f - am) / f : null };
            }).filter(Boolean).sort((x: any, y: any) => (y.a - y.f) - (x.a - x.f)).slice(0, 10);
            setPopup({ s, a, du, np, negItems });
          } else setPopup(null);
        }} />
      </div>

      {popup && (
        <div className="modal-bg" onClick={() => setPopup(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h"><b>{ymLabel(popup.s.ym)} 할인율 안내</b><button className="modal-x" onClick={() => setPopup(null)}>✕</button></div>
            <p className="modal-note">할인율이 <b>음수(−)</b>인 항목은 <b>판매액 &gt; 판매시점공장도</b>, 즉 <b>공장도(기준가)보다 높은 가격에 판매</b>되어 음수로 표시됩니다. (특가 외 거래·공장도 저가 기록 등)</p>
            <table className="dtable">
              <thead><tr><th>구분</th><th className="num">판매액</th><th className="num">공장도</th><th className="num">할인율</th></tr></thead>
              <tbody>
                <tr className={cx(popup.a < 0 && "neg-row")}><td>전체</td><td className="num">{F.wonShort(popup.s.sales)}</td><td className="num">{F.wonShort(popup.s.factory)}</td><td className="num">{F.pct(popup.a)}</td></tr>
                <tr className={cx(popup.du < 0 && "neg-row")}><td>유통</td><td className="num">{F.wonShort(popup.s.du)}</td><td className="num">{F.wonShort(popup.s.duf || 0)}</td><td className="num">{F.pct(popup.du)}</td></tr>
                <tr className={cx(popup.np < 0 && "neg-row")}><td>납품</td><td className="num">{F.wonShort(popup.s.np)}</td><td className="num">{F.wonShort((popup.s as any).npf || 0)}</td><td className="num">{F.pct(popup.np)}</td></tr>
              </tbody>
            </table>
            {popup.negItems && popup.negItems.length > 0 && (
              <>
                <p className="modal-sub">공장도보다 비싸게 판매된 품번 (음수 유발)</p>
                <div className="modal-scroll">
                  <table className="dtable">
                    <thead><tr><th>품번</th><th className="num">판매액</th><th className="num">공장도</th><th className="num">할인율</th></tr></thead>
                    <tbody>
                      {popup.negItems.map((it: any) => (
                        <tr key={it.품번} className="neg-row">
                          <td><div className="invm-name">{it.품번}</div><div className="invm-meta">{it.품명}</div></td>
                          <td className="num">{F.wonShort(it.a)}</td>
                          <td className="num">{F.wonShort(it.f)}</td>
                          <td className="num">{it.d != null ? F.pct(it.d) : "공장도0"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="modal-foot">원가성 정보(매출이익 등)는 표시되지 않습니다.</p>
          </div>
        </div>
      )}

      <Chips options={["전체", "유통", "납품"]} value={ch} onChange={setCh} />
      <div className="card pad0 scroll-x">
        <table className="dtable dmatrix">
          <thead>
            <tr>
              <th>출고월</th><th className="num">전체</th>
              {CAT_ORDER.map((c) => <th key={c} className="num">{SHORT[c]}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ym}>
                <td>{ymLabel(r.ym)}</td>
                <td className="num amber-txt">{F.pct(r.전체)}</td>
                {r.cats.map((v, i) => <td key={i} className="num muted">{v != null ? F.pct(v) : "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">할인율 = (판매시점공장도 − 판매액) / 공장도. 표는 <b>{ch}</b> 기준 출고월×제품군. 원가성 정보는 표시되지 않습니다.</p>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <>
      <div className="kpis">{[0, 1, 2, 3].map((i) => <div className="kpi" key={i}><Skeleton w="60%" h={12} /><Skeleton w="80%" h={26} /><Skeleton w="50%" h={12} /></div>)}</div>
      <Skeleton h={40} r={12} />
      <div className="card"><Skeleton w="40%" h={16} /><Skeleton h={150} r={10} /></div>
    </>
  );
}
