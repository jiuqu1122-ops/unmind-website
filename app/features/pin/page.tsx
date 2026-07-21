import type { Metadata } from "next";
import { FeaturePage } from "../feature-page";

export const metadata: Metadata = {
  title: "截图置顶｜灵感抽屉",
  description: "截取屏幕任意区域并保持置顶，让关键参考在建模、设计与写作过程中始终可见。",
};

export default function PinPage() {
  return <FeaturePage kind="pin" />;
}
