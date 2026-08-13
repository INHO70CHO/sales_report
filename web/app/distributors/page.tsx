"use client";
/* 유통점 상세 ⭐ — 기간 선택기 + KPI 4 + 탭 5 (핵심 화면). GitHub Pages 정적 export 대응으로 code는 쿼리 파라미터(?code=)로 전달 */
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cx, orderStatus, avgIntervalDays } from "@/lib/util";
import { aggregate, cachedIndex } from "@/lib/data";
import { useDist } from "@/lib/hooks";
import { F, ymLabel } from "@/lib/format";
import { YM_MIN, YM_MAX, ymList } from "@/lib/months";
import { pushRecent } from "@/lib/recent";
import { KpiCard, Tabs } from "@/components/ui";
import { IconBack, IconStar } from "@/components/icons";
import { MonthRangePicker } from "@/components/period-picker";
import { TabSales, TabItems, TabInventory, TabDiscount, DetailSkeleton } from "@/components/detail-tabs";

const DEFAULT_S = 202501;
const DEFAULT_E = YM_MAX;

export default function DistributorDetailPage() {
  return (
    <Suspense fallback={<div className="screen detail" />}>
      <DetailInner />
    </Suspense>
  );
}

function DetailInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const code = Number(sp.get("code"));
  const startYM = Number(sp.get("s")) || DEFAULT_S;
  const endYM = Number(sp.get("e")) || DEFAULT_E;
  const tab = sp.get("tab") || "sales";

  const { dist, loading, error } = useDist(code);

  useEffect(() => { if (dist) pushRecent(code); }, [dist, code]);

  const agg = useMemo(() => (dist ? aggregate(dist, startYM, endYM) : null), [dist, startYM, endYM]);
  const [itemCat, setItemCat] = useState("전체"); // 주요품목 분류 선택 (KPI 연동)

  function setParams(next: { s?: number; e?: number; tab?: string }) {
    const p = new URLSearchParams(sp.toString());
    if (next.s != null) p.set("s", String(next.s));
    if (next.e != null) p.set("e", String(next.e));
    if (next.tab != null) p.set("tab", next.tab);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  // 로딩 중 헤더 제목: 인덱스 캐시에서 이름 미리 표시
  const metaName = dist?.name ?? cachedIndex()?.distributors.find((x) => x.code === code)?.name ?? "";

  if (error) {
    return (
      <div className="screen detail">
        <header className="dheader"><div className="dhead-top"><button className="iconbtn" onClick={() => router.back()} aria-label="뒤로"><IconBack /></button><div className="dhead-title"><h1>거래처를 찾을 수 없습니다</h1><span className="dhead-sub">코드 {String(sp.get("code"))}</span></div></div></header>
      </div>
    );
  }

  const st = agg ? orderStatus(agg.daysSince, agg.avgGap) : { level: "none" as const, text: "" };
  const trend = agg && agg.prevPeriodSales ? (agg.periodSales - agg.prevPeriodSales) / agg.prevPeriodSales : undefined;

  // 주요품목 분류 선택 시 그 분류 기준 KPI (수전금구 등). 주요품목 탭에서만 적용.
  const effectiveCat = tab === "items" ? itemCat : "전체";
  function catMetrics(cat: string) {
    if (!agg || !dist) return null;
    const items = agg.ranking.filter((r) => r.대분류 === cat);
    let periodSales = 0, cumSales = 0, periodFactory = 0;
    const ordSet = new Set<string>();
    let lastIso: string | null = null;
    items.forEach((it) => {
      it.monthly.forEach((m) => {
        if (m.ym <= endYM) cumSales += m.amount;
        if (m.ym >= startYM && m.ym <= endYM) { periodSales += m.amount; periodFactory += (m.factory || 0); }
      });
      (it.orders || []).forEach((d) => {
        const ym = Number(d.slice(0, 4)) * 100 + Number(d.slice(5, 7));
        if (ym >= startYM && ym <= endYM) ordSet.add(d);
        if (!lastIso || d > lastIso) lastIso = d;
      });
    });
    const avgDisc = periodFactory > 0 ? (periodFactory - periodSales) / periodFactory : 0;
    const avgGap = avgIntervalDays(Array.from(ordSet).sort());
    const daysSince = lastIso ? Math.round((new Date(dist.asof).getTime() - new Date(lastIso).getTime()) / 86400000) : null;
    return { periodSales, cumSales, avgDisc, avgGap, daysSince };
  }
  const cm = effectiveCat !== "전체" ? catMetrics(effectiveCat) : null;
  const cst = cm ? orderStatus(cm.daysSince, cm.avgGap) : st;
  const monthsN = Math.max(1, ymList(startYM, endYM).length); // 검색기간 개월수
  const periodSalesVal = cm ? cm.periodSales : (agg ? agg.periodSales : 0);
  const avgMonthly = periodSalesVal / monthsN; // 월평균 판매액

  const tabs = [
    { id: "sales", label: "판매실적" },
    { id: "items", label: "주요품목" },
    { id: "inv", label: "보관품" },
    { id: "disc", label: "할인율" },
  ];

  function openItem(품번: string) {
    router.push(`/distributors/items?code=${code}&sku=${encodeURIComponent(품번)}&s=${startYM}&e=${endYM}`);
  }
  function openInvMonth(ym: number) {
    router.push(`/distributors/inventory?code=${code}&ym=${ym}`);
  }

  return (
    <div className="screen detail" data-screen-label="유통점상세">
      <header className="dheader">
        <div className="dhead-top">
          <button className="iconbtn" onClick={() => router.back()} aria-label="뒤로"><IconBack /></button>
          <div className="dhead-title">
            <h1>{metaName || `거래처 ${code}`}</h1>
            <span className="dhead-sub">{code}{dist ? ` · ${dist.region} · ${dist.사원}` : ""}</span>
          </div>
          <button className="iconbtn fav" aria-label="즐겨찾기"><IconStar /></button>
        </div>
        <MonthRangePicker startYM={startYM} endYM={endYM} onChange={(s, e) => setParams({ s, e })} />
      </header>

      <div className="dbody">
        {loading || !agg || !dist ? (
          <DetailSkeleton />
        ) : (
          <>
            {cm && (
              <div className="cat-banner">
                <span><b>‘{effectiveCat}’</b> 분류 기준 KPI</span>
                <button onClick={() => setItemCat("전체")}>전체 보기</button>
              </div>
            )}
            <div className="kpis">
              <KpiCard label="월평균 판매액" value={F.wonShort(avgMonthly)} trend={cm ? undefined : trend} accent="navy" spark={cm ? undefined : agg.series} sparkColor="sp-navy" />
              <KpiCard label="누계 판매액" value={F.wonShort(cm ? cm.cumSales : agg.cumSales)} sub={`${ymLabel(YM_MIN)}~ 누적`} />
              <KpiCard label="평균 할인율" value={F.pct(cm ? cm.avgDisc : agg.avgDisc)} accent="amber" sub="공장도 대비" />
              <KpiCard label="판매주기" value={(cm ? cm.avgGap : agg.avgGap) != null ? `${cm ? cm.avgGap : agg.avgGap}일` : "—"} accent={cst.level === "warn" ? "danger" : null} sub={(cm ? cm.daysSince : agg.daysSince) != null ? `마지막 ${cm ? cm.daysSince : agg.daysSince}일 전` : "이력 없음"} />
            </div>

            {st.level === "warn" && (
              <div className="alert">⚠ <b>{st.text}</b> — 마지막 발주 {agg.daysSince}일 전(평균 {agg.avgGap}일). 발주 공백 상담 포인트입니다.</div>
            )}

            <Tabs tabs={tabs} active={tab} onChange={(id) => setParams({ tab: id })} />

            {tab === "sales" && <TabSales agg={agg} items={dist.items} />}
            {tab === "items" && <TabItems agg={agg} startYM={startYM} endYM={endYM} onOpenItem={openItem} cat={itemCat} onCat={setItemCat} />}
            {tab === "inv" && <TabInventory invMonthly={dist.invMonthly} startYM={startYM} endYM={endYM} onOpenInvMonth={openInvMonth} />}
            {tab === "disc" && <TabDiscount agg={agg} items={dist.items} startYM={startYM} endYM={endYM} />}
          </>
        )}
      </div>
    </div>
  );
}
