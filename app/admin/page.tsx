import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-shared";
import { AdminConsole } from "./admin-console";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: "管理员后台｜灵感抽屉",
  description: "灵感抽屉网页管理员后台。",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className={styles.page}>
      <SiteHeader active="admin" />
      <AdminConsole />
      <SiteFooter />
    </main>
  );
}
