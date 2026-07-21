import type { Metadata } from "next";
import { FeaturePage } from "../feature-page";

export const metadata: Metadata = {
  title: "便签与日程｜灵感抽屉",
  description: "用便签记录灵感，用日历安排创作节奏，在灵感抽屉中连接想法、待办与项目素材。",
};

export default function NotesPage() {
  return <FeaturePage kind="notes" />;
}
