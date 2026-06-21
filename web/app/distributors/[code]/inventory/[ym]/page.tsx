"use client";
/* 보관품 월별 상세 — 선택한 보관월의 품목을 보관금액 내림차순으로 */
import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useDist } from "@/lib/hooks";
import { F, ymLabel } from "@/lib/format";
import { Skeleton } from "@/components/ui";
import { IconBack } from "@/components/icons";

export default function InventoryMonthPage() {
  const params = useParams();
  const router = useRouter();
  const code = Number(params.code);
  const ym = Number(params.ym);
  const { dist, loading, error } = useDist(code);

  if (loading) {
    return (
      <div className="screen detail">
        <header className="dheader"><div className="dhead-top"><button className="iconbtn" onClick={() => router.back()} aria-label="뒤로"><IconBack /></button><div className="dhead-title"><h1>불러오는 중…</h1></div></div></header>
        <div className="dbody"><div className="card"><Skeleton h={120} r={10} /></div></div>
      </div>
    );
  }
  if (error || !dist) {
    return (
      <div className="screen detail">
        <header className="dheader"><div className="dhead-top"><button className="iconbtn" onClick={() => router.back()} aria-label="뒤로"><IconBack /></button><div className="dhead-title"><h1>데이터를 찾을 수 없습니다</h1></div></div></header>
      </div>
    );
  }

  const items = (dist.invByMonth?.[String(ym)] || []).slice().sort((a, b) => b.보관금액 - a.보관금액);
  const total = items.reduce((a, r) => a + r.보관금액, 0);
  const totalQty = items.reduce((a, r) => a + r.보관수량, 0);
  const surveyDate = (dist.invMonthly || []).find((m) => m.ym === ym)?.date || ""; // 보관 조사일(그 달 최종 보관월)
  const lastYm = dist.invDate ? Number(dist.invDate.slice(0, 4)) * 100 + Number(dist.invDate.slice(5, 7)) : 0;
  const isLast = ym === lastYm; // 마지막 보관월에서만 품목별 보관 매출일 표기

  return (
    <div className="screen detail" data-screen-label="보관품월상세">
      <header className="dheader">
        <div className="dhead-top">
          <button className="iconbtn" onClick={() => router.back()} aria-label="뒤로"><IconBack /></button>
          <div className="dhead-title">
            <h1>보관품 {ymLabel(ym)}</h1>
            <span className="dhead-sub">{dist.name} · {dist.code}{surveyDate ? ` · 보관 조사일 ${surveyDate}` : ""}</span>
          </div>
          <span style={{ width: 36 }} />
        </div>
      </header>
      <div className="dbody">
        {items.length === 0 ? (
          <div className="empty"><div className="empty-ic">◷</div><p>해당 보관월 품목이 없습니다</p></div>
        ) : (
          <>
            <div className="inv-summary">
              <div><span className="is-cap">보관 조사일</span><strong>{surveyDate || "—"}</strong></div>
              <div><span className="is-cap">보관 품목</span><strong>{items.length}종</strong></div>
              <div><span className="is-cap">총 보관수량</span><strong>{F.num(totalQty)}개</strong></div>
              <div><span className="is-cap">총 보관금액</span><strong className="amber-txt">{F.wonShort(total)}</strong></div>
            </div>
            <div className="card pad0">
              <table className="dtable">
                <thead><tr><th>순위</th><th>품번</th>{isLast && <th>보관매출일</th>}<th className="num">보관수량</th><th className="num">보관금액</th></tr></thead>
                <tbody>
                  {items.map((r, i) => (
                    <tr key={r.품번 + i}>
                      <td className="muted">{i + 1}</td>
                      <td>
                        <div className="invm-name">{r.품번}</div>
                        <div className="invm-meta"><span className="tag">{r.대분류}</span>{r.품명}</div>
                      </td>
                      {isLast && <td className="muted">{r.보관일 || "—"}</td>}
                      <td className="num">{F.num(r.보관수량)}개</td>
                      <td className="num">{F.won(r.보관금액)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">{surveyDate ? `${surveyDate} 보관 조사 기준` : `${ymLabel(ym)} 말 스냅샷 기준`}{isLast ? " · 보관매출일=품목별 주문작성일" : ""} · 보관금액 내림차순.</p>
          </>
        )}
      </div>
    </div>
  );
}
