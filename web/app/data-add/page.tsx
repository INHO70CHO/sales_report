"use client";
/* 데이터 추가 (관리자) — 비번 게이트(2003@#) → 엑셀 업로드 → 미리보기 → 적용 / 초기화
   기존 데이터 유지 + 추가 실적만 반영 (거래처+출고월 upsert). 반영 범위: 이 기기. */
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/lib/util";
import { DistData, IndexEntry, invalidate } from "@/lib/data";
import { ymLabel } from "@/lib/format";
import { ingestWorkbook, IngestResult } from "@/lib/ingest";
import { getOverlay, setOverlay, clearOverlay, mergeDist, buildIndexEntry, OverlayState } from "@/lib/overlay";
import { IconBack, IconUpload, IconLock } from "@/components/icons";
import { BASE_PATH } from "@/lib/base-path";

const ADMIN_PW = "2003@#";

export default function DataAddPage() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    try { setUnlocked(sessionStorage.getItem("royal_admin") === "1"); } catch {}
  }, []);

  return (
    <div className="screen admin" data-screen-label="데이터추가">
      <header className="simple-head">
        <div className="admin-head">
          <button className="iconbtn" onClick={() => router.push("/")} aria-label="홈"><IconBack /></button>
          <div><h1>데이터 추가</h1><span>엑셀 업로드 · 관리자 전용</span></div>
        </div>
      </header>
      <div className="admin-body">
        {unlocked ? <Uploader /> : <Gate onUnlock={() => setUnlocked(true)} />}
      </div>
    </div>
  );
}

function Gate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  function submit(e?: React.FormEvent) {
    e && e.preventDefault();
    if (pw === ADMIN_PW) {
      try { sessionStorage.setItem("royal_admin", "1"); } catch {}
      onUnlock();
    } else {
      setErr("비밀번호가 올바르지 않습니다");
    }
  }
  return (
    <div className="admin-gate">
      <div className="gate-card">
        <div className="gate-ic"><IconLock /></div>
        <h3>관리자 인증</h3>
        <p>데이터 추가는 관리자 비밀번호가 필요합니다.</p>
        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span>관리자 비밀번호</span>
            <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="••••••" autoFocus />
          </label>
          {err && <div className="field-err">⚠ {err}</div>}
          <button type="submit" className="btn-primary">확인</button>
        </form>
      </div>
      <p className="note">※ 본 화면은 사내 관리자 전용입니다. 비밀번호 외부 공유 금지.</p>
    </div>
  );
}

function Uploader() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [current, setCurrent] = useState<OverlayState | null>(null);

  useEffect(() => { getOverlay().then(setCurrent); }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr(""); setDone(""); setResult(null); setFileName(f.name); setParsing(true);
    try {
      const buf = await f.arrayBuffer();
      const res = ingestWorkbook(buf);
      if (!res.dists.length) { setErr("거래처 실적을 찾지 못했습니다. 시트/컬럼 형식을 확인하세요."); }
      else setResult(res);
    } catch (e: any) {
      setErr("파일을 읽지 못했습니다: " + (e?.message || "형식 오류"));
    } finally {
      setParsing(false);
    }
  }

  async function apply() {
    if (!result) return;
    setBusy(true); setErr(""); setDone("");
    try {
      const dists: Record<number, DistData> = {};
      const entries: IndexEntry[] = [];
      for (const ov of result.dists) {
        dists[ov.code] = ov;
        let base: DistData | null = null;
        try { const r = await fetch(`${BASE_PATH}/data/dist/${ov.code}.json`); if (r.ok) base = await r.json(); } catch {}
        entries.push(buildIndexEntry(mergeDist(base, ov)));
      }
      const state: OverlayState = {
        asof: new Date().toISOString().slice(0, 10),
        dists, entries, meta: result.meta,
      };
      await setOverlay(state);
      invalidate();
      setCurrent(state);
      setResult(null); setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      setDone(`추가 반영 완료 — 거래처 ${state.entries.length}곳 (이 기기). 검색/상세에서 확인하세요.`);
    } catch (e: any) {
      setErr("적용 실패: " + (e?.message || "오류"));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true); setErr(""); setDone("");
    try {
      await clearOverlay();
      invalidate();
      setCurrent(null);
      setDone("추가 데이터를 초기화했습니다. 기본 데이터로 복귀했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="uploader">
      {current && (
        <div className="card overlay-now">
          <div><b>현재 추가 반영됨 (이 기기)</b>
            <span className="muted"> · 거래처 {current.entries.length}곳 · 기간 {current.meta.ymMin ? ymLabel(current.meta.ymMin) : "-"}~{current.meta.ymMax ? ymLabel(current.meta.ymMax) : "-"} · 적용일 {current.asof}</span>
          </div>
          <button className="btn-ghost btn-sm" onClick={reset} disabled={busy}>추가 데이터 초기화</button>
        </div>
      )}

      <div className="card upload-card">
        <div className="upload-ic"><IconUpload /></div>
        <h3>실적 엑셀 업로드</h3>
        <p className="muted">기존과 동일한 형식(23~26년실적 + 보관품현황 시트). 기존 데이터는 유지되고 <b>겹치는 월은 교체, 새 월·새 거래처는 추가</b>됩니다.</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="file-input" onChange={onFile} disabled={parsing || busy} />
        {fileName && <div className="file-name">{parsing ? "분석 중… " : "선택됨: "}{fileName}</div>}
        {err && <div className="field-err">⚠ {err}</div>}
        {done && <div className="ok-msg">✓ {done}</div>}
      </div>

      {result && (
        <div className="card preview-card">
          <div className="card-head"><h3>미리보기</h3></div>
          <div className="prev-grid">
            <div><span>거래처</span><b>{result.meta.distCount.toLocaleString()}곳</b></div>
            <div><span>판매 행</span><b>{result.meta.rowCount.toLocaleString()}건</b></div>
            <div><span>기간</span><b>{result.meta.ymMin ? ymLabel(result.meta.ymMin) : "-"} ~ {result.meta.ymMax ? ymLabel(result.meta.ymMax) : "-"}</b></div>
            <div><span>보관품</span><b>{result.meta.invCount.toLocaleString()}건</b></div>
          </div>
          <div className="prev-actions">
            <button className="btn-ghost" onClick={() => { setResult(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }} disabled={busy}>취소</button>
            <button className={cx("btn-primary", busy && "btn-loading")} onClick={apply} disabled={busy}>
              {busy ? <span className="spinner" /> : "기존 데이터에 추가 반영"}
            </button>
          </div>
        </div>
      )}

      <p className="note">반영 범위는 <b>이 기기(브라우저)</b>입니다. 모든 사용자에게 영구 반영하려면 원본 엑셀을 교체해 ETL(`etl/build_data.py`) 재실행 후 재배포하세요.</p>
    </div>
  );
}
