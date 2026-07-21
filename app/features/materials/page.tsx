import type { Metadata } from "next";
import { FeaturePage } from "../feature-page";

export const metadata: Metadata = {
  title: "素材管理｜灵感抽屉",
  description: "用灵感抽屉统一管理图片、视频、文本与项目文件，让素材库与无限画布保持连接。",
};

export default function MaterialsPage() {
  return <FeaturePage kind="materials" />;
}
