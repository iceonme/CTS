"use client";

import { useEffect, useRef } from "react";
import { startFeedScheduler, stopFeedScheduler } from "@/lib/feed/publisher";

/**
 * Feed 定时任务调度器
 * 在应用启动时自动启动，卸载时停止
 */
export default function FeedScheduler() {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      console.log("[FeedScheduler] 启动定时任务...");
      startFeedScheduler();
    }

    return () => {
      console.log("[FeedScheduler] 停止定时任务...");
      stopFeedScheduler();
    };
  }, []);

  return null; // 这是一个逻辑组件，不渲染任何 UI
}
