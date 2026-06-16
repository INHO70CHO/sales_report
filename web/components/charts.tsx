"use client";
/* SVG 차트 — 월별 막대(+누계선) · 라인(할인율 꺾은선) · 스파크라인 */
import React, { useState } from "react";
import { F, ymLabel, ymShort } from "@/lib/format";
import { cx } from "@/lib/util";

/* 데이터 크기에 맞춘 nice 눈금 간격(%·금액 공용) */
function niceStep(rng: number): number {
  if (rng <= 0) return 1;
  const raw = rng / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const nn = raw / mag;
  const s = nn < 1.5 ? 1 : nn < 3 ? 2 : nn < 7 ? 5 : 10;
  return s * mag;
}

/* ---------- 월별 막대 차트 (+선택적 누계선) ---------- */
export function BarChart({
  data,
  height = 150,
  valueKey = "sales",
  showCumLine = false,
  onSelect,
}: {
  data: any[];
  height?: number;
  valueKey?: string;
  showCumLine?: boolean;
  onSelect?: (i: number) => void;
}) {
  const W = 100, H = 100;
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <div className="chart-empty">데이터 없음</div>;
  const max = Math.max(...data.map((d) => d[valueKey])) || 1;
  const cumMax = showCumLine ? Math.max(...data.map((d) => d.cum)) || 1 : 1;
  const n = data.length;
  const gap = n > 24 ? 0.18 : 0.28;
  const bw = (W / n) * (1 - gap);

  const cumPts = showCumLine
    ? data.map((d, i) => {
        const x = (i + 0.5) * (W / n);
        const y = H - (d.cum / cumMax) * H * 0.92 - 4;
        return [x, y];
      })
    : [];
  const cumPath = cumPts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2)).join(" ");

  return (
    <div className="chart" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart-svg">
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} className="grid-line" vectorEffect="non-scaling-stroke" />
        ))}
        {data.map((d, i) => {
          const h = Math.max(1.5, (d[valueKey] / max) * H * 0.92);
          const x = i * (W / n) + (W / n - bw) / 2;
          const isLast = i === n - 1;
          return (
            <rect
              key={i}
              x={x}
              y={H - h}
              width={bw}
              height={h}
              rx="0.6"
              className={cx("bar", isLast && "bar-last", hover === i && "bar-hover", onSelect && "bar-link")}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect && onSelect(i)}
            />
          );
        })}
        {showCumLine && <path d={cumPath} className="cum-line" vectorEffect="non-scaling-stroke" fill="none" />}
      </svg>
      <div className="chart-axis">
        {data.map((d, i) => {
          const step = n > 18 ? 6 : n > 9 ? 3 : 1;
          return (
            <span key={i} className="axis-tick" style={{ flex: 1 }}>
              {(i % step === 0 && n - 1 - i >= 2) || i === n - 1 ? ymShort(d.ym) : ""}
            </span>
          );
        })}
      </div>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${((hover + 0.5) / n) * 100}%` }}>
          <strong>{ymLabel(data[hover].ym)}</strong>
          <span>{F.won(data[hover][valueKey])}</span>
          {showCumLine && <span className="tip-sub">누계 {F.wonShort(data[hover].cum)}</span>}
        </div>
      )}
    </div>
  );
}

/* ---------- 라인(꺾은선) 차트 — 월별 점 + 선택 시 값 표시 ----------
   color: 선/점 색상(navy=매출, amber=할인율) · sublines: 툴팁 보조줄(유통/납품) · compact: 축 숨김(카드용) */
export function LineChart({
  data,
  height = 150,
  valueKey = "disc",
  fmt = (v: number) => F.pct(v),
  color = "amber",
  sublines = [],
  compact = false,
  onSelect,
  yfmt,
}: {
  data: any[];
  height?: number;
  valueKey?: string;
  fmt?: (v: number) => string;
  color?: "amber" | "navy";
  sublines?: { label: string; key: string }[];
  compact?: boolean;
  onSelect?: (i: number) => void;
  yfmt?: (v: number) => string;
}) {
  const W = 100, H = 100;
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <div className="chart-empty">데이터 없음</div>;
  const vals = data.map((d) => d[valueKey] || 0);
  const rawMin = Math.min(0, ...vals), rawMax = Math.max(...vals);
  let min: number, max: number;
  const ticks: number[] = [];
  if (compact) {
    min = rawMin; max = rawMax * 1.15 || 1;
  } else {
    const step = niceStep(rawMax - rawMin);
    min = Math.floor(rawMin / step) * step;
    max = Math.ceil(rawMax / step) * step;
    for (let v = min; v <= max + 1e-9; v += step) ticks.push(v);
  }
  const range = max - min || 1;
  const n = data.length, plotH = compact ? height : height - 18;
  const yv = (v: number) => (H - 4) - ((v - min) / range) * (H - 8);
  const pts = data.map((d, i) => [n === 1 ? W / 2 : (i / (n - 1)) * W, yv(d[valueKey] || 0)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2)).join(" ");
  const yL = yfmt || fmt;

  return (
    <div className={cx("chart", color === "navy" && "chart-navy")} style={{ height }} onMouseLeave={() => setHover(null)}>
      <div className="mlc-body">
        {!compact && (
          <div className="mlc-yaxis" style={{ height: plotH }}>
            {ticks.map((t, k) => <span key={k} className={cx("yt", Math.abs(t) < 1e-9 && "yt-zero")} style={{ top: `${yv(t)}%` }}>{yL(t)}</span>)}
          </div>
        )}
        <div className="chart-plot mlc-plot" style={{ height: plotH }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart-svg-line">
            {compact
              ? [0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} className="grid-line" vectorEffect="non-scaling-stroke" />)
              : ticks.map((t, k) => <line key={k} x1="0" x2={W} y1={yv(t)} y2={yv(t)} className={Math.abs(t) < 1e-9 ? "grid-zero" : "grid-line"} vectorEffect="non-scaling-stroke" />)}
            <path d={line} className="area-line" vectorEffect="non-scaling-stroke" fill="none" />
          </svg>
          {pts.map((p, i) => (
            <span key={"h" + i} className={cx("hitcol", onSelect && "hitcol-link")} style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }}
              onMouseEnter={() => setHover(i)} onClick={() => { setHover(i); onSelect && onSelect(i); }} />
          ))}
          {pts.map((p, i) => (
            <span key={"d" + i} className={cx("ldot", hover === i && "ldot-on")} style={{ left: `${p[0]}%`, top: `${p[1]}%` }} />
          ))}
          {hover != null && (
            <div className="chart-tip" style={{ left: `${(hover / Math.max(1, n - 1)) * 100}%` }}>
              <strong>{ymLabel(data[hover].ym)}</strong>
              <span>{fmt(data[hover][valueKey])}</span>
              {sublines.map((s) => (
                <span key={s.key} className="tip-sub2">{s.label} {fmt(data[hover][s.key])}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      {!compact && (
        <div className="chart-axis mlc-xaxis">
          {data.map((d, i) => {
            const step = n > 18 ? 6 : n > 9 ? 3 : 1;
            return (
              <span key={i} className="axis-tick" style={{ flex: 1 }}>
                {(i % step === 0 && n - 1 - i >= 2) || i === n - 1 ? ymShort(d.ym) : ""}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- 도넛 차트 (분류별 구성비) ----------
   items: 양수 분류(슬라이스). centerTotal: 중앙 합계(순액=양수+반품). returns: 반품·조정 합(음수). */
export function Donut({ items, centerTotal, returns }: { items: { label: string; value: number; color: string }[]; centerTotal?: number; returns?: number }) {
  const pos = items.reduce((s, i) => s + i.value, 0) || 1;
  const center = centerTotal != null ? centerTotal : pos;
  const R = 42, C = 2 * Math.PI * R;
  let off = 0;
  if (!items.length) return <div className="chart-empty">데이터 없음</div>;
  return (
    <div className="donut-wrap">
      <div className="donut-svgwrap">
        <svg viewBox="0 0 100 100" className="donut-svg">
          <g transform="rotate(-90 50 50)">
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--line-2)" strokeWidth="14" />
            {items.map((it, i) => {
              const dash = (it.value / pos) * C;
              const seg = (
                <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={it.color} strokeWidth="14"
                  strokeDasharray={`${dash.toFixed(2)} ${(C - dash).toFixed(2)}`} strokeDashoffset={(-off).toFixed(2)} />
              );
              off += dash;
              return seg;
            })}
          </g>
        </svg>
        <div className="donut-center"><strong>{F.wonShort(center)}</strong><span>합계(순)</span></div>
      </div>
      <div className="donut-legend">
        {items.map((it) => (
          <div className="dlg" key={it.label}>
            <span className="dlg-dot" style={{ background: it.color }} />
            <span className="dlg-l">{it.label}</span>
            <span className="dlg-v">{F.wonShort(it.value)}</span>
            <span className="dlg-p">{((it.value / pos) * 100).toFixed(0)}%</span>
          </div>
        ))}
        {returns != null && returns < 0 && (
          <div className="dlg" key="__ret">
            <span className="dlg-dot" style={{ background: "#cbd5e1" }} />
            <span className="dlg-l muted">반품·조정</span>
            <span className="dlg-v muted">{F.wonShort(returns)}</span>
            <span className="dlg-p" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- 다중 꺾은선 (전체/유통/납품 등 여러 시리즈) ---------- */
export function MultiLineChart({
  data, lines, height = 170, fmt = (v: number) => F.pct(v), yfmt = (v: number) => Math.round(v * 100) + "%", onPointClick,
}: {
  data: any[];
  lines: { key: string; label: string; color: string; emph?: boolean }[];
  height?: number;
  fmt?: (v: number) => string;
  yfmt?: (v: number) => string;
  onPointClick?: (i: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <div className="chart-empty">데이터 없음</div>;
  const vals = data.flatMap((d) => lines.map((l) => d[l.key] || 0));
  const rawMin = Math.min(0, ...vals), rawMax = Math.max(...vals);
  const step = niceStep(rawMax - rawMin);
  const min = Math.floor(rawMin / step) * step;
  const max = Math.ceil(rawMax / step) * step;
  const range = max - min || 1;
  const n = data.length, W = 100, H = 100, plotH = height - 18;
  const yv = (v: number) => (H - 4) - ((v - min) / range) * (H - 8);
  const xy = (v: number, i: number): [number, number] => [n === 1 ? W / 2 : (i / (n - 1)) * W, yv(v)];
  const ticks: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return (
    <div className="chart">
      <div className="mlc-body">
        <div className="mlc-yaxis" style={{ height: plotH }}>
          {ticks.map((t, k) => <span key={k} className={cx("yt", Math.abs(t) < 1e-9 && "yt-zero")} style={{ top: `${yv(t)}%` }}>{yfmt(t)}</span>)}
        </div>
        <div className="chart-plot mlc-plot" style={{ height: plotH }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg-line">
            {ticks.map((t, k) => <line key={k} x1="0" x2={W} y1={yv(t)} y2={yv(t)} className={Math.abs(t) < 1e-9 ? "grid-zero" : "grid-line"} vectorEffect="non-scaling-stroke" />)}
            {lines.slice().sort((a, b) => (a.emph ? 1 : 0) - (b.emph ? 1 : 0)).map((l) => {
              const path = data.map((d, i) => { const [x, y] = xy(d[l.key] || 0, i); return (i ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2); }).join(" ");
              return <path key={l.key} d={path} fill="none" stroke={l.color} strokeWidth={l.emph ? 3.5 : 1.5} strokeOpacity={l.emph ? 1 : 0.55} vectorEffect="non-scaling-stroke" />;
            })}
          </svg>
          {data.map((d, i) => lines.filter((l) => l.emph).map((l) => { const [x, y] = xy(d[l.key] || 0, i); return <span key={l.key + i} className={cx("ldot", hover === i && "ldot-on")} style={{ left: `${x}%`, top: `${y}%`, borderColor: l.color, borderWidth: 3 }} />; }))}
          {data.map((d, i) => <span key={"h" + i} className={cx("hitcol", onPointClick && "hitcol-link")} style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }} onMouseEnter={() => setHover(i)} onClick={() => { setHover(i); onPointClick && onPointClick(i); }} />)}
          {hover != null && (
            <div className="chart-tip" style={{ left: `${(hover / Math.max(1, n - 1)) * 100}%` }}>
              <strong>{ymLabel(data[hover].ym)}</strong>
              {lines.map((l) => <span key={l.key} className="tip-ml"><i style={{ background: l.color }} />{l.label} {fmt(data[hover][l.key] || 0)}</span>)}
            </div>
          )}
        </div>
      </div>
      <div className="chart-axis mlc-xaxis">
        {data.map((d, i) => { const step = n > 18 ? 6 : n > 9 ? 3 : 1; return <span key={i} className="axis-tick" style={{ flex: 1 }}>{(i % step === 0 && n - 1 - i >= 2) || i === n - 1 ? ymShort(d.ym) : ""}</span>; })}
      </div>
      <div className="mlc-legend">
        {lines.map((l) => <span key={l.key} className={cx("mlc-lg", l.emph && "mlc-emph")}><i style={{ background: l.color, height: l.emph ? 5 : 3 }} />{l.label}</span>)}
      </div>
    </div>
  );
}

/* ---------- 스파크라인 (KPI 카드 미니) ---------- */
export function Sparkline({ data, valueKey = "sales", className = "" }: { data: any[]; valueKey?: string; className?: string }) {
  if (!data || !data.length) return null;
  const vals = data.map((d) => d[valueKey]);
  const max = Math.max(...vals) || 1;
  const min = Math.min(...vals);
  const range = max - min || 1;
  const n = data.length, W = 100, H = 28;
  const pts = data.map((d, i) => [n === 1 ? W / 2 : (i / (n - 1)) * W, H - ((d[valueKey] - min) / range) * (H - 4) - 2]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cx("spark", className)}>
      <path d={line} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
