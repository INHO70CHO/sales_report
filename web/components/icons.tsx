/* 라인 아이콘 + 로고 워드마크 */
import React from "react";

export const Svg = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p} />
);

export function IconSearch(p: any) { return <Svg className="ic" {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Svg>; }
export function IconOrg(p: any) { return <Svg className="ic" {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Svg>; }
export function IconUser(p: any) { return <Svg className="ic" {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></Svg>; }
export function IconBack(p: any) { return <Svg className="ic" {...p}><path d="M15 18l-6-6 6-6" /></Svg>; }
export function IconChevron(p: any) { return <Svg className="ic" {...p}><path d="M9 6l6 6-6 6" /></Svg>; }
export function IconClock(p: any) { return <Svg className="ic" {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>; }
export function IconBox(p: any) { return <Svg className="ic" {...p}><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" /></Svg>; }
export function IconStar(p: any) { return <Svg className="ic" {...p}><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5L12 3z" /></Svg>; }
export function IconPin(p: any) { return <Svg className="ic" {...p}><path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></Svg>; }
export function IconUpload(p: any) { return <Svg className="ic" {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" /></Svg>; }
export function IconLock(p: any) { return <Svg className="ic" {...p}><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></Svg>; }

export function Logo({ size = 20 }: { size?: number }) {
  return (
    <span className="logo" style={{ fontSize: size }}>
      <span className="logo-mark">R</span>
      <span className="logo-word">ROYAL <em>유통현황</em></span>
    </span>
  );
}
