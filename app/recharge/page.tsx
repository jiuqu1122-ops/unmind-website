import type { Metadata } from "next";
import { RechargeClient } from "./recharge-client";

export const metadata: Metadata = {
  title: "积分充值｜UNMIND",
  description: "Inspiration Drawer 安全积分充值页面",
};

export default function RechargePage() {
  return <RechargeClient />;
}
