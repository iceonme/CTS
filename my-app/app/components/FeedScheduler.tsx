"use client";

import { useEffect, useRef } from "react";

/**
 * Feed 定时任务调度器
 * 只在服务端运行，客户端不执行
 */
export default function FeedScheduler() {
  const initialized = useRef(false);

  useEffect(() => {
    // 只在服务端运行（Node.js 环境）
    if (typeof window !== 'undefined') {
      // 客户端：不启动定时任务
      return;
    }
    
    if (!initialized.current) {
      initialized.current = true;
      // 动态导入，避免客户端打包问题
      import("@/lib/feed/publisher").then(({ startFeedScheduler }) => {
        console.log("[FeedScheduler] 启动定时任务...");
        startFeedScheduler();
      });
    }

    return () => {
      import("@/lib/feed/publisher").then(({ stopFeedScheduler }) => {
        console.log("[FeedScheduler] 停止定时任务...");
        stopFeedScheduler();
      });
    };
  }, []);

  return null;
}
