"use client";
/* 공용 UI — 추세배지 · KPI카드 · 탭 · 칩 · 스켈레톤 · 검색바 */
import React, { useMemo, useRef, useState } from "react";
import { cx } from "@/lib/util";
import { searchList, IndexEntry } from "@/lib/data";
import { Sparkline } from "@/components/charts";
import { IconSearch } from "@/components/icons";

/* ---------- 추세 배지 (색상+텍스트 병기, 접근성) ---------- */
export function TrendBadge({ delta }: { delta?: number }) {
  if (delta == null || !isFinite(delta)) return null;
  const up = delta >= 0;
  const cls = up ? "trend trend-up" : "trend trend-down";
  return (
    <span className={cls}>
      <span className="trend-arrow" aria-hidden="true">{up ? "▲" : "▼"}</span>
      {up ? "증가" : "감소"} {Math.abs(delta * 100).toFixed(1)}%
    </span>
  );
}

/* ---------- KPI 카드 ---------- */
export function KpiCard({
  label,
  value,
  sub,
  accent,
  trend,
  spark,
  sparkColor,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string | null;
  trend?: number;
  spark?: any[];
  sparkColor?: string;
}) {
  return (
    <div className={cx("kpi", accent && "kpi-" + accent)}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-foot">
        {trend !== undefined ? <TrendBadge delta={trend} /> : sub ? <span className="kpi-sub">{sub}</span> : <span className="kpi-sub">&nbsp;</span>}
      </div>
      {spark && <Sparkline data={spark} className={sparkColor} />}
    </div>
  );
}

/* ---------- 탭 ---------- */
export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id} className={cx("tab", active === t.id && "tab-active")} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- 필터 칩 ---------- */
export function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} className={cx("chip", value === o && "chip-active")} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

/* ---------- 스켈레톤 ---------- */
export function Skeleton({ w = "100%", h = 16, r = 8, className = "" }: { w?: string | number; h?: number; r?: number; className?: string }) {
  return <div className={cx("skeleton", className)} style={{ width: w, height: h, borderRadius: r }} />;
}

/* ---------- 거래처 검색바 ---------- */
export function SearchBar({
  value,
  onChange,
  onPick,
  list,
  autoFocus,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (d: IndexEntry) => void;
  list: IndexEntry[];
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const results = useMemo(() => searchList(list, value).slice(0, 6), [list, value]);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="searchwrap" ref={ref}>
      <div className="searchbar">
        <IconSearch />
        <input
          className="searchinput"
          value={value}
          autoFocus={autoFocus}
          placeholder={placeholder || "거래처코드 또는 거래처명"}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {value && <button className="search-clear" onClick={() => onChange("")} aria-label="지우기">✕</button>}
      </div>
      {open && value.trim() && (
        <div className="suggest">
          {results.length === 0 && <div className="suggest-empty">검색 결과가 없습니다</div>}
          {results.map((d) => (
            <button key={d.code} className="suggest-item" onMouseDown={() => { onPick(d); setOpen(false); }}>
              <span className="suggest-name">{highlight(d.name, value)}</span>
              <span className="suggest-meta">{d.code} · {d.region}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function highlight(text: string, q: string): React.ReactNode {
  const i = text.toLowerCase().indexOf(q.trim().toLowerCase());
  if (i < 0 || !q.trim()) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.trim().length)}</mark>
      {text.slice(i + q.trim().length)}
    </>
  );
}
