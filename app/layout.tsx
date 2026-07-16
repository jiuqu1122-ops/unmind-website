import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "灵感抽屉｜为灵感留一个位置",
  description: "灵感抽屉是一款本地优先的无限画布创作工具，集中管理素材并内置工业设计工作流，一键完成从需求拆解到交付整理的设计全流程。",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
