/* 사용자 로그인 — 사용자 명단(users.json) + 비밀번호(기본 1111, 변경분은 localStorage)
   ※ 정적 앱이라 비밀번호는 브라우저 localStorage 보관(약한 보안, 사내 MVP). 강한 인증은 Supabase로 승격 권장. */
const DEFAULT_PW = "1111";

let _users: string[] | null = null;
export async function fetchUsers(): Promise<string[]> {
  if (_users) return _users;
  try {
    const r = await fetch("/data/users.json");
    _users = r.ok ? ((await r.json()).users || []) : [];
  } catch {
    _users = [];
  }
  return _users!;
}

export function isAllowed(name: string, users: string[]): boolean {
  return users.includes(name.trim());
}

export function getPw(name: string): string {
  try { return localStorage.getItem("royal_pw_" + name.trim()) || DEFAULT_PW; } catch { return DEFAULT_PW; }
}
export function setPw(name: string, pw: string) {
  try { localStorage.setItem("royal_pw_" + name.trim(), pw); } catch {}
}
export function isDefaultPw(name: string): boolean {
  try { return !localStorage.getItem("royal_pw_" + name.trim()); } catch { return true; }
}

export function currentUser(): string {
  try { return localStorage.getItem("royal_user") || ""; } catch { return ""; }
}
export function setUser(name: string) {
  try { localStorage.setItem("royal_user", name.trim()); } catch {}
}
