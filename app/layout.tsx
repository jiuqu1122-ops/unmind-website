import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "灵感抽屉｜为灵感留一个位置",
  description: "灵感抽屉是一款本地优先的无限画布创作工具，集中管理图片、视频、笔记与 AI 生成内容，服务器不留存你的画布和素材。",
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
