"use client";

import { ReactNode } from "react";
import FeedScheduler from "./FeedScheduler";

/**
 * 应用级客户端组件包装器
 * 用于初始化定时任务等客户端逻辑
 */
export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <FeedScheduler />
      {children}
    </>
  );
}
