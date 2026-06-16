"use client";
/* 로그인 — 사용자 명단 + 비밀번호(최초 1111, 이후 변경된 비번) */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/lib/util";
import { Logo } from "@/components/icons";
import { setAuthed } from "@/components/nav";
import { fetchUsers, isAllowed, getPw, isDefaultPw, setUser } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<string[]>([]);

  useEffect(() => { fetchUsers().then(setUsers); }, []);

  function submit(e?: React.FormEvent) {
    e && e.preventDefault();
    const nm = name.trim();
    if (!nm || !pw) { setErr("이름과 비밀번호를 입력하세요"); return; }
    if (!isAllowed(nm, users)) { setErr("사용 권한이 없는 이름입니다"); return; }
    if (pw !== getPw(nm)) { setErr("비밀번호가 올바르지 않습니다 (최초 비밀번호 1111)"); return; }
    setErr("");
    setLoading(true);
    setTimeout(() => {
      setUser(nm);
      setAuthed(true);
      // 기본 비번이면 변경 안내차 내정보로, 아니면 홈
      router.push(isDefaultPw(nm) ? "/me?first=1" : "/");
    }, 500);
  }

  return (
    <div className="screen login" data-screen-label="로그인">
      <div className="login-card">
        <div className="login-brand"><Logo size={26} /></div>
        <p className="login-tag">영업본부 전용 · 유통점 현황 조회</p>
        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span>이름</span>
            <input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="예: 홍길동" autoComplete="username" />
          </label>
          <label className="field">
            <span>비밀번호</span>
            <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="최초 1111" autoComplete="current-password" />
          </label>
          {err && <div className="field-err">⚠ {err}</div>}
          <button type="submit" className={cx("btn-primary", loading && "btn-loading")} disabled={loading}>
            {loading ? <span className="spinner" /> : "로그인"}
          </button>
        </form>
        <p className="login-hint">최초 비밀번호는 <b>1111</b> 입니다. 로그인 후 <b>내정보</b>에서 변경하세요.</p>
      </div>
      <p className="login-foot">사내 전용 · 거래처·할인율 정보 외부 공유 주의</p>
    </div>
  );
}
