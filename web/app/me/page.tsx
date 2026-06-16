"use client";
/* 내정보 — 사용자 + 비밀번호 변경(성공 시 닫힘) + 초기화 + 로그아웃 */
import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cx } from "@/lib/util";
import { IconUser } from "@/components/icons";
import { setAuthed } from "@/components/nav";
import { currentUser, getPw, setPw, isDefaultPw } from "@/lib/auth";

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="screen profile" />}>
      <ProfileInner />
    </Suspense>
  );
}

function ProfileInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [n1, setN1] = useState("");
  const [n2, setN2] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const u = currentUser();
    setName(u);
    const def = isDefaultPw(u);
    setIsDefault(def);
    if (sp.get("first") === "1" || def) setPwOpen(true); // 최초/기본비번이면 변경창 열기
  }, [sp]);

  function logout() { setAuthed(false); router.replace("/login"); }
  function clearForm() { setCur(""); setN1(""); setN2(""); }

  function changePw(e?: React.FormEvent) {
    e && e.preventDefault();
    setMsg(""); setErr("");
    if (cur !== getPw(name)) { setErr("현재 비밀번호가 올바르지 않습니다 (기본 1111 · 이미 바꿨다면 변경한 비번)"); return; }
    if (!n1 || n1.length < 4) { setErr("새 비밀번호는 4자 이상이어야 합니다"); return; }
    if (n1 !== n2) { setErr("새 비밀번호가 일치하지 않습니다"); return; }
    if (n1 === "1111") { setErr("기본 비밀번호(1111)는 사용할 수 없습니다"); return; }
    setPw(name, n1);
    setIsDefault(false);
    clearForm();
    setPwOpen(false); // 절차대로 변경 완료 → 변경창 닫기
    setMsg("비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.");
  }

  function resetPw() {
    try { localStorage.removeItem("royal_pw_" + name.trim()); } catch {}
    setIsDefault(true);
    clearForm();
    setErr("");
    setMsg("비밀번호를 기본값(1111)으로 초기화했습니다. 새 비밀번호로 변경하세요.");
    setPwOpen(true);
  }

  return (
    <div className="screen profile" data-screen-label="내정보">
      <header className="simple-head"><h1>내정보</h1></header>
      <div className="profile-body">
        <div className="prof-card">
          <div className="prof-avatar"><IconUser /></div>
          <div>
            <strong>{name || "사용자"}</strong>
            <span>로얄앤컴퍼니 영업본부</span>
            <span className={cx("muted", isDefault && "st-warn")}>{isDefault ? "기본 비밀번호(1111) 사용 중 — 변경 권장" : "비밀번호 설정됨"}</span>
          </div>
        </div>

        <div className="prof-pw">
          <div className="pw-head">
            <span className="pw-title">비밀번호 변경</span>
            {!pwOpen && <button className="pw-toggle" onClick={() => { setMsg(""); setErr(""); setPwOpen(true); }}>변경하기</button>}
          </div>
          {msg && <div className="ok-msg">✓ {msg}</div>}
          {pwOpen && (
            <form onSubmit={changePw} className="pw-form">
              <label className="field"><span>현재 비밀번호</span><input type="password" value={cur} onChange={(e) => { setCur(e.target.value); setErr(""); }} placeholder="현재 비밀번호 (최초 1111)" /></label>
              <label className="field"><span>새 비밀번호</span><input type="password" value={n1} onChange={(e) => { setN1(e.target.value); setErr(""); }} placeholder="4자 이상" /></label>
              <label className="field"><span>새 비밀번호 확인</span><input type="password" value={n2} onChange={(e) => { setN2(e.target.value); setErr(""); }} placeholder="다시 입력" /></label>
              {err && <div className="field-err">⚠ {err}</div>}
              <div className="pw-actions">
                <button type="button" className="btn-ghost" onClick={() => { clearForm(); setErr(""); setPwOpen(false); }}>취소</button>
                <button type="submit" className="btn-primary">변경</button>
              </div>
              <button type="button" className="pw-reset" onClick={resetPw}>비밀번호를 잊으셨나요? 1111로 초기화</button>
            </form>
          )}
        </div>

        <div className="prof-info">
          <div><span>데이터 갱신</span><b>월 1회 배치</b></div>
          <div><span>조회 권한</span><b>전체 데이터 (권한 구분 없음)</b></div>
          <div><span>원가 정보</span><b className="muted">표시 보류 (보안 정책)</b></div>
        </div>
        <button className="btn-ghost" onClick={logout}>로그아웃</button>
        <p className="login-foot">사내 전용 · 외부 공유 주의</p>
      </div>
    </div>
  );
}
