"use client";
/* 반응형 셸 — 모바일 하단 네비 / 데스크톱 사이드바 + 통과형 인증 가드 */
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cx } from "@/lib/util";
import { BASE_PATH } from "@/lib/base-path";
import { IconSearch, IconOrg, IconUser, Logo } from "@/components/icons";

/* usePathname()은 basePath(GitHub Pages 서브경로)와 trailingSlash(/login/)를 포함해 반환하므로 비교 전에 정규화 */
function stripBasePath(p: string): string {
  let out = BASE_PATH && p.startsWith(BASE_PATH) ? p.slice(BASE_PATH.length) || "/" : p;
  if (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

const NAV_ITEMS = [
  { id: "home", label: "검색", href: "/", icon: IconSearch },
  { id: "org", label: "조직", href: "/org", icon: IconOrg },
  { id: "me", label: "내정보", href: "/me", icon: IconUser },
];

export function isAuthed(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem("royal_auth") === "1"; } catch { return false; }
}
export function setAuthed(v: boolean) {
  try { v ? localStorage.setItem("royal_auth", "1") : localStorage.removeItem("royal_auth"); } catch {}
}

function activeOf(pathname: string): string | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/org")) return "org";
  if (pathname.startsWith("/me")) return "me";
  return null; // 상세/품목 등 오버레이 화면
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = stripBasePath(usePathname() || "/");
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const authed = mounted && isAuthed();

  useEffect(() => {
    if (mounted && !authed && pathname !== "/login") router.replace("/login");
  }, [mounted, authed, pathname, router]);

  function logout() {
    setAuthed(false);
    router.replace("/login");
  }

  // 로그인 화면은 크롬 없이 전체화면
  if (pathname === "/login") return <>{children}</>;

  // 인증 확인 전(또는 미인증 리다이렉트 중)에는 빈 화면
  if (!mounted || !authed) return <div className="app-shell" />;

  const active = activeOf(pathname);

  return (
    <div className="app-shell">
      <Sidebar active={active} onLogout={logout} />
      <div className="app-main">
        <div className="app-scroll">{children}</div>
      </div>
      <BottomNav active={active} />
    </div>
  );
}

function Sidebar({ active, onLogout }: { active: string | null; onLogout: () => void }) {
  const router = useRouter();
  return (
    <aside className="sidebar">
      <div className="sb-logo"><Logo size={16} /></div>
      <nav className="sb-nav">
        {NAV_ITEMS.map((it) => {
          const Ic = it.icon;
          return (
            <button key={it.id} className={cx("sb-item", active === it.id && "sb-item-active")} onClick={() => router.push(it.href)}>
              <Ic /><span>{it.label}</span>
            </button>
          );
        })}
      </nav>
      <button className="sb-logout" onClick={onLogout}>로그아웃</button>
    </aside>
  );
}

export function BottomNav({ active }: { active: string | null }) {
  const router = useRouter();
  return (
    <nav className="bottomnav">
      {NAV_ITEMS.map((it) => {
        const Ic = it.icon;
        return (
          <button key={it.id} className={cx("navbtn", active === it.id && "navbtn-active")} onClick={() => router.push(it.href)}>
            <Ic />
            <span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
