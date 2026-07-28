import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-shared";
import { InspirationSpace } from "./inspiration-space";
import styles from "./space.module.css";

export const metadata: Metadata = {
  title: "灵感空间｜分享节点预设与工作流",
  description: "浏览、分享和下载灵感抽屉节点预设与工作流 JSON。",
};

export default function InspirationSpacePage() {
  return (
    <main className={styles.page}>
      <SiteHeader active="space" />
      <InspirationSpace />
      <SiteFooter />
    </main>
  );
}
