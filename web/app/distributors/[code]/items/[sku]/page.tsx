"use client";
/* 품목 드릴다운 — 품목 월별 판매 추이 + 월별 수량·금액 테이블 */
import React, { Suspense, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useDist } from "@/lib/hooks";
import { cx, orderStatus } from "@/lib/util";
import { F, ymLabel } from "@/lib/format";
import { YM_MAX } from "@/lib/months";
import { KpiCard, Skeleton } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { IconBack } from "@/components/icons";

const DEFAULT_S = 202501;
const DEFAULT_E = YM_MAX;

export default function ItemDrilldownPage() {
  return (
    <Suspense fallback={<div className="screen detail" />}>
      <ItemInner />
    </Suspense>
  );
}

function ItemInner() {
  const params = useParams();
  const router = useRouter();
  const sp = useSearchParams();

  const code = Number(params.code);
  const sku = decodeURIComponent(String(params.sku));
  const startYM = Number(sp.get("s")) || DEFAULT_S;
  const endYM = Number(sp.get("e")) || DEFAULT_E;

  const { dist, loading, error } = useDist(code);
  const [selYm, setSelYm] = useState<number | null>(null); // 출고월 선택 팝업
  const item = dist ? dist.items.find((x) => x.품번 === sku) : undefined;

  if (loading) {
    return (
      <div className="screen detail">
        <header className="dheader"><div className="dhead-top"><button className="iconbtn" onClick={() => router.back()} aria-label="뒤로"><IconBack /></button><div className="dhead-title"><h1>불러오는 중…</h1></div></div></header>
        <div className="dbody"><div className="kpis kpis-2"><Skeleton h={70} r={12} /><Skeleton h={70} r={12} /></div><div className="card"><Skeleton h={150} r={10} /></div></div>
      </div>
    );
  }

  if (error || !dist || !item) {
    return (
      <div className="screen detail">
        <header className="dheader"><div className="dhead-top"><button className="iconbtn" onClick={() => router.back()} aria-label="뒤로"><IconBack /></button><div className="dhead-title"><h1>품목을 찾을 수 없습니다</h1></div></div></header>
      </div>
    );
  }

  const series = item.monthly.filter((m) => m.ym >= startYM && m.ym <= endYM);
  const totAmt = series.reduce((a, m) => a + m.amount, 0);
  const totQty = series.reduce((a, m) => a + m.qty, 0);

  // 이 품목의 판매주기 (기간 내 발주 간격 + 마지막 발주 경과일)
  const iod = (item.orders || []).filter((iso) => {
    const ym = Number(iso.slice(0, 4)) * 100 + Number(iso.slice(5, 7));
    return ym >= startYM && ym <= endYM;
  });
  let itemGap: number | null = null;
  if (iod.length >= 2) {
    let sum = 0;
    for (let i = 1; i < iod.length; i++) sum += (new Date(iod[i]).getTime() - new Date(iod[i - 1]).getTime()) / 86400000;
    itemGap = Math.round(sum / (iod.length - 1));
  }
  const lastIso = item.orders && item.orders.length ? item.orders[item.orders.length - 1] : null;
  const itemDaysSince = lastIso ? Math.round((new Date(dist.asof).getTime() - new Date(lastIso).getTime()) / 86400000) : null;
  const itemSt = orderStatus(itemDaysSince, itemGap);

  return (
    <div className="screen detail" data-screen-label="품목드릴다운">
      <header className="dheader">
        <div className="dhead-top">
          <button className="iconbtn" onClick={() => router.back()} aria-label="뒤로"><IconBack /></button>
          <div className="dhead-title"><h1>{item.품번}</h1><span className="dhead-sub">{item.품명} · {item.대분류} · {dist.name}</span></div>
          <span style={{ width: 36 }} />
        </div>
      </header>
      <div className="dbody">
        <div className="kpis kpis-2">
          <KpiCard label="기간 판매액" value={F.wonShort(totAmt)} accent="navy" spark={series} sparkColor="sp-navy" />
          <KpiCard label="기간 판매수량" value={F.num(totQty) + "개"} sub={`${ymLabel(startYM)} ~ ${ymLabel(endYM)}`} />
        </div>
        <div className="card">
          <div className="card-head"><h3>월별 판매 추이</h3><span className="legend muted">막대 선택 시 출고일</span></div>
          <BarChart data={series} valueKey="amount" height={160} onSelect={(i) => setSelYm(series[i].ym)} />
        </div>
        <div className="card pad0">
          <table className="dtable">
            <thead><tr><th>출고월</th><th className="num">판매액</th><th className="num">수량</th></tr></thead>
            <tbody>
              {series.slice().reverse().map((r) => (
                <tr key={r.ym}><td>{ymLabel(r.ym)}</td><td className="num">{F.won(r.amount)}</td><td className="num">{F.num(r.qty)}개</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 판매주기 — 하단, 제품 우측에 표기 */}
        <div className="item-cycle">
          <div className="ic-prod">
            <b>{item.품명}</b>
            <span>{item.품번} · {item.대분류}</span>
          </div>
          <div className="ic-cyc">
            <span className="ic-cap">주문주기</span>
            <b>평균 {itemGap != null ? `${itemGap}일` : "—"}</b>
            <span className={cx("ic-last", "st-" + itemSt.level)}>
              {itemDaysSince != null ? `마지막 ${itemDaysSince}일 전` : "발주 이력 없음"}
            </span>
          </div>
        </div>
      </div>

      {selYm != null && (() => {
        const row = series.find((m) => m.ym === selYm);
        const days = (item.orders || []).filter((iso) => Number(iso.slice(0, 4)) * 100 + Number(iso.slice(5, 7)) === selYm).sort();
        return (
          <div className="modal-bg" onClick={() => setSelYm(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-h"><b>{ymLabel(selYm)} 출고 내역</b><button className="modal-x" onClick={() => setSelYm(null)}>✕</button></div>
              <div className="inv-summary">
                <div><span className="is-cap">출고일수</span><strong>{days.length}일</strong></div>
                <div><span className="is-cap">수량</span><strong>{F.num(row?.qty || 0)}개</strong></div>
                <div><span className="is-cap">금액</span><strong className="amber-txt">{F.wonShort(row?.amount || 0)}</strong></div>
              </div>
              <p className="modal-sub">출고일</p>
              {days.length ? (
                <div className="modal-scroll"><div className="day-chips">{days.map((d) => <span key={d} className="day-chip">{d.slice(5).replace("-", "/")}</span>)}</div></div>
              ) : <p className="note">해당 월 출고일 정보가 없습니다.</p>}
              <p className="modal-foot">{item.품번} · {item.품명}</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
