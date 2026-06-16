import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/nav";

export const metadata: Metadata = {
  title: "유통점 현황조회",
  description: "로얄앤컴퍼니 영업본부 — 외근 중 유통점 판매·재고·할인율 현황 조회 (사내 전용)",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1E40AF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
