"use client";
/* 홈 / 검색 — 기간 선택 + 최근 본 / 매출 상위(전체·유통·납품) 카드(월별 꺾은선) */
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/lib/util";
import { IndexEntry } from "@/lib/data";
import { F } from "@/lib/format";
import { MONTHS, YM_MAX } from "@/lib/months";
import { getRecent } from "@/lib/recent";
import { useIndex, useDist } from "@/lib/hooks";
import { SearchBar, Skeleton, Chips } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { Logo, IconSearch, IconUpload } from "@/components/icons";
import { MonthRangePicker } from "@/components/period-picker";

const METRICS: Record<string, { key: "sales" | "du" | "np"; label: string }> = {
  "전체": { key: "sales", label: "기간 매출" },
  "유통": { key: "du", label: "유통 매출" },
  "납품": { key: "np", label: "납품 매출" },
};

export default function HomePage() {
  const router = useRouter();
  const { index, loading } = useIndex();
  const [query, setQuery] = useState("");
  const [recentCodes, setRecentCodes] = useState<number[]>([]);
  const [metric, setMetric] = useState("전체");
  const e0 = YM_MAX, i0 = MONTHS.indexOf(e0);
  const [period, setPeriod] = useState({ s: MONTHS[Math.max(0, i0 - 11)], e: e0 }); // 기본 최근 12개월

  useEffect(() => { setRecentCodes(getRecent()); }, []);

  function onPick(d: IndexEntry) { router.push(`/distributors/${d.code}`); }

  const list = index?.distributors ?? [];
  const byCode = useMemo(() => new Map(list.map((d) => [d.code, d])), [list]);
  const recents = recentCodes.map((c) => byCode.get(c)).filter(Boolean) as IndexEntry[];
  const mk = METRICS[metric];
  const ranked = useMemo(
    () => list.slice().sort((a, b) => (mk.key === "du" ? b.s6du - a.s6du : mk.key === "np" ? b.s6np - a.s6np : b.sales6 - a.sales6)).slice(0, 8),
    [list, mk.key],
  );

  // 전체 보관 현황 (보관조사일 = 전체 마지막 보관월)
  const invDate = index?.invDate;
  const invTotal = useMemo(() => list.reduce((s, d) => s + (d.inv || 0), 0), [list]);
  const invHolders = useMemo(() => list.filter((d) => (d.invn || 0) > 0).length, [list]);
  const invTop = useMemo(() => list.filter((d) => (d.inv || 0) > 0).sort((a, b) => (b.inv || 0) - (a.inv || 0)).slice(0, 8), [list]);

  return (
    <div className="screen home" data-screen-label="홈검색">
      <header className="home-head">
        <Logo size={18} />
        <button className="add-data-btn" onClick={() => router.push("/data-add")} aria-label="데이터 추가">
          <IconUpload /><span>데이터 추가</span>
        </button>
      </header>
      <div className="home-search">
        <SearchBar value={query} onChange={setQuery} onPick={onPick} list={list} />
      </div>

      <div className="home-body">
        <div className="card home-period">
          <span className="hp-cap">조회 기간</span>
          <MonthRangePicker startYM={period.s} endYM={period.e} onChange={(s, e) => setPeriod({ s, e })} />
        </div>

        {loading ? (
          <div className="recent-list">{[0, 1, 2].map((i) => <div className="recent" key={i}><Skeleton w="50%" h={16} /><Skeleton w="35%" h={12} /><Skeleton h={46} r={6} /></div>)}</div>
        ) : (
          <>
            {recents.length > 0 && (
              <>
                <div className="section-head"><h3>최근 본 유통점</h3><span className="sh-count">{recents.length}</span></div>
                <div className="recent-list">
                  {recents.map((d) => <HomeCard key={d.code} d={d} startYM={period.s} endYM={period.e} vKey="sales" label="기간 매출" onPick={onPick} />)}
                </div>
              </>
            )}

            <div className="section-head"><h3>매출 상위 유통점</h3></div>
            <Chips options={["전체", "유통", "납품"]} value={metric} onChange={setMetric} />
            {ranked.length === 0 ? (
              <div className="empty home-empty"><div className="empty-ic"><IconSearch /></div><p>유통점이 없습니다</p></div>
            ) : (
              <div className="recent-list">
                {ranked.map((d) => <HomeCard key={d.code} d={d} startYM={period.s} endYM={period.e} vKey={mk.key} label={mk.label} onPick={onPick} />)}
              </div>
            )}

            {invHolders > 0 && (
              <>
                <div className="section-head"><h3>전체 보관 현황</h3><span className="sh-date">보관조사일 {invDate || "—"}</span></div>
                <div className="card inv-dash">
                  <div className="inv-summary">
                    <div><span className="is-cap">총 보관금액</span><strong className="amber-txt">{F.wonShort(invTotal)}</strong></div>
                    <div><span className="is-cap">보관 보유 유통점</span><strong>{invHolders}곳</strong></div>
                    <div><span className="is-cap">전체 유통점</span><strong>{list.length}곳</strong></div>
                  </div>
                  <p className="note">보관조사일({invDate || "—"}) 스냅샷에 보관품이 있는 유통점만 집계 · 그 날짜에 보관 없는 곳은 제외.</p>
                </div>
                <div className="section-sub">보관금액 상위 유통점</div>
                <div className="card pad0">
                  <table className="dtable">
                    <thead><tr><th>유통점</th><th className="num">보관 품목</th><th className="num">보관금액</th></tr></thead>
                    <tbody>
                      {invTop.map((d) => (
                        <tr key={d.code} className="row-link" onClick={() => router.push(`/distributors/${d.code}?tab=inv`)}>
                          <td>
                            <div className="invm-name">{d.name}</div>
                            <div className="invm-meta">{d.code} · {d.region} · {d.사원}</div>
                          </td>
                          <td className="num muted">{d.invn}종</td>
                          <td className="num">{F.wonShort(d.inv || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HomeCard({ d, startYM, endYM, vKey, label, onPick }: {
  d: IndexEntry; startYM: number; endYM: number; vKey: "sales" | "du" | "np"; label: string; onPick: (d: IndexEntry) => void;
}) {
  const { dist, loading } = useDist(d.code);
  const series = useMemo(() => (dist ? dist.monthly.filter((m) => m.ym >= startYM && m.ym <= endYM) : []), [dist, startYM, endYM]);
  const amt = series.reduce((a, m) => a + ((m as any)[vKey] || 0), 0);
  return (
    <div className="recent">
      <button className="recent-hd" onClick={() => onPick(d)}>
        <span className="recent-top">
          <span className="recent-name">{d.name}</span>
          <span className={cx("dot-status", "ds-" + d.lvl)} title={d.lvl} />
        </span>
        <span className="recent-meta">{d.code} · {d.region} · {d.사원}</span>
      </button>
      {loading ? <Skeleton h={46} r={6} /> : (
        <LineChart data={series} valueKey={vKey} color="navy" compact height={48} fmt={(v) => F.wonShort(v)} />
      )}
      <div className="recent-foot">
        <span>{label} {F.wonShort(amt)}</span>
        <span className={cx("recent-gap", "st-" + d.lvl)}>{d.days != null ? `마지막 ${d.days}일 전` : "이력 없음"}</span>
      </div>
    </div>
  );
}
