"use client";

import { useState, useEffect } from "react";
import ChatInterface from "./components/ChatInterface";
import PADashboard from "./components/PADashboard";
import { getPAConfigManager } from "@/lib/skills/config/manager";
import type { PAConfigBundle } from "@/lib/skills/config/types";

export default function Home() {
  const [config, setConfig] = useState<PAConfigBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 初始化配置管理器并加载配置
    const configManager = getPAConfigManager();
    const loadedConfig = configManager.getConfig();
    setConfig(loadedConfig);
    setIsLoading(false);
  }, []);

  if (isLoading || !config) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">加载助手配置中...</div>
      </div>
    );
  }

  const { identity, global } = config;
  const watchlistDisplay = global.watchlist.symbols.join(", ");

  return (
    <div className="min-h-screen bg-gray-950">
      {/* 顶部导航 */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{identity.avatar}</span>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {identity.name}
                  <span className="ml-2 text-sm font-normal text-gray-400">{identity.title}</span>
                </h1>
                <p className="text-xs text-gray-400">
                  {identity.expertise.join(" · ")}
                </p>
              </div>
            </div>
            <nav className="flex items-center gap-4">
              <a href="/" className="text-sm font-medium text-blue-400">首页</a>
              <a href="/feed" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                情报流
              </a>
              <a href="/warroom" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                WarRoom
              </a>
              <a
                href="/settings"
                className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                ⚙️ 设置
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
          {/* 左侧边栏 - 快速信息 */}
          <div className="hidden lg:block lg:col-span-1 space-y-4">
            {/* 市场概览卡片 */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h3 className="text-sm font-medium text-gray-400 mb-3">📊 市场概览</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">BTC</span>
                  <span className="text-sm text-green-400">+2.3%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">DOGE</span>
                  <span className="text-sm text-red-400">-1.2%</span>
                </div>
              </div>
            </div>

            {/* PA 看板 */}
            <PADashboard />

            {/* 快捷导航 */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h3 className="text-sm font-medium text-gray-400 mb-3">⚡ 快捷导航</h3>
              <div className="space-y-2">
                <a
                  href="/feed"
                  className="block px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
                >
                  📜 查看情报流
                </a>
                <a
                  href="/warroom"
                  className="block px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
                >
                  ⚔️ 进入 WarRoom
                </a>
                <a
                  href="/settings"
                  className="block px-3 py-2 bg-purple-900/30 hover:bg-purple-900/50 rounded-lg text-sm text-purple-300 transition-colors"
                >
                  ⚙️ 配置 {identity.name}
                </a>
              </div>
            </div>

            {/* 欢迎语预览 */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h3 className="text-sm font-medium text-gray-400 mb-2">💬 问候</h3>
              <p className="text-xs text-gray-500 italic">
                &ldquo;{identity.greeting.substring(0, 60)}...&rdquo;
              </p>
            </div>
          </div>

          {/* 右侧 - PA 对话界面 */}
          <div className="lg:col-span-3 h-full">
            <ChatInterface paName={identity.name} paAvatar={identity.avatar} />
          </div>
        </div>
      </main>
    </div>
  );
}
