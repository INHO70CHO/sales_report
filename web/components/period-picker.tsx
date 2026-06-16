"use client";
/* 기간(시작월~종료월) 선택기 + 프리셋 */
import React, { useState } from "react";
import { cx } from "@/lib/util";
import { MONTHS, YM_MIN, YM_MAX } from "@/lib/months";
import { ymLabel, ymShort } from "@/lib/format";

export function MonthRangePicker({
  startYM,
  endYM,
  onChange,
}: {
  startYM: number;
  endYM: number;
  onChange: (s: number, e: number) => void;
}) {
  const [open, setOpen] = useState<"start" | "end" | null>(null);
  const months = MONTHS;

  function pick(which: "start" | "end", ym: number) {
    let s = startYM, e = endYM;
    if (which === "start") { s = ym; if (s > e) e = s; }
    else { e = ym; if (e < s) s = e; }
    onChange(s, e);
    setOpen(null);
  }

  const presets = [
    { label: "최근 6개월", fn: () => { const e = YM_MAX; const idx = months.indexOf(e); onChange(months[Math.max(0, idx - 5)], e); } },
    { label: "최근 12개월", fn: () => { const e = YM_MAX; const idx = months.indexOf(e); onChange(months[Math.max(0, idx - 11)], e); } },
    { label: "올해", fn: () => onChange(202601, YM_MAX) },
    { label: "전체", fn: () => onChange(YM_MIN, YM_MAX) },
  ];

  return (
    <div className="period">
      <div className="period-fields">
        <button className={cx("period-btn", open === "start" && "period-btn-open")} onClick={() => setOpen(open === "start" ? null : "start")}>
          <span className="period-cap">시작월</span>
          <span className="period-val">{ymLabel(startYM)}</span>
        </button>
        <span className="period-tilde">~</span>
        <button className={cx("period-btn", open === "end" && "period-btn-open")} onClick={() => setOpen(open === "end" ? null : "end")}>
          <span className="period-cap">종료월</span>
          <span className="period-val">{ymLabel(endYM)}</span>
        </button>
      </div>
      <div className="period-presets">
        {presets.map((p) => <button key={p.label} className="preset" onClick={p.fn}>{p.label}</button>)}
      </div>
      {open && (
        <div className="monthgrid-pop">
          <div className="monthgrid">
            {months.map((ym) => {
              const sel = open === "start" ? ym === startYM : ym === endYM;
              const inRange = ym >= startYM && ym <= endYM;
              return (
                <button key={ym} className={cx("mg-cell", sel && "mg-sel", !sel && inRange && "mg-inrange")} onClick={() => pick(open, ym)}>
                  {ymShort(ym)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
