"use client";

import { useEffect, useState } from "react";
import { getPAConfigManager } from "@/lib/skills/config/manager";
import { getPortfolioManager } from "@/lib/trading/portfolio";

interface DashboardData {
  paName: string;
  paAvatar: string;
  lastAnalysisTime: Date;
  portfolioValue: number;
  todayPnl: number;
  activePositions: number;
  pendingInstructions: number;
  marketSentiment: "bullish" | "bearish" | "neutral";
  latestInsight: string;
}

export default function PADashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const configManager = getPAConfigManager();
    const paConfig = configManager.getConfig();
    const portfolio = getPortfolioManager().getPortfolio();

    setData({
      paName: paConfig.identity.name,
      paAvatar: paConfig.identity.avatar,
      lastAnalysisTime: new Date(Date.now() - 5 * 60 * 1000), // 5分钟前
      portfolioValue: portfolio.totalEquity,
      todayPnl: portfolio.totalReturn,
      activePositions: portfolio.positions.length,
      pendingInstructions: 2, // 模拟数据
      marketSentiment: "neutral",
      latestInsight: "BTC技术面中性，DOGE弱势，建议观望",
    });
  }, []);

  if (!data) return null;

  const isProfit = data.todayPnl >= 0;

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border border-gray-700 p-4">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{data.paAvatar}</span>
          <div>
            <h3 className="font-semibold text-white">{data.paName}</h3>
            <p className="text-xs text-gray-400">上次研判: {data.lastAnalysisTime.toLocaleTimeString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-xs text-green-400">监控中</span>
        </div>
      </div>

      {/* 关键指标 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400">Portfolio 总值</div>
          <div className="text-lg font-bold text-white">
            ${data.portfolioValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className={`text-xs ${isProfit ? "text-green-400" : "text-red-400"}`}>
            {isProfit ? "+" : ""}{data.todayPnl.toFixed(2)} ({((data.todayPnl / 10000) * 100).toFixed(2)}%)
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400">市场情绪</div>
          <div className={`text-lg font-bold ${
            data.marketSentiment === "bullish" ? "text-green-400" :
            data.marketSentiment === "bearish" ? "text-red-400" : "text-yellow-400"
          }`}>
            {data.marketSentiment === "bullish" ? "看涨" :
             data.marketSentiment === "bearish" ? "看跌" : "中性"}
          </div>
          <div className="text-xs text-gray-500">
            持仓: {data.activePositions} 个币种
          </div>
        </div>
      </div>

      {/* 最新洞察 */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 mb-3">
        <div className="text-xs text-blue-400 mb-1">💡 最新研判</div>
        <div className="text-sm text-gray-300">{data.latestInsight}</div>
      </div>

      {/* 待执行指令 */}
      {data.pendingInstructions > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-yellow-400">
              ⚠️ 有 {data.pendingInstructions} 条交易指令待执行
            </div>
            <a
              href="/warroom"
              className="text-xs text-yellow-400 hover:text-yellow-300 underline"
            >
              查看详情 →
            </a>
          </div>
        </div>
      )}

      {/* 快捷链接 */}
      <div className="grid grid-cols-3 gap-2">
        <a
          href="/warroom"
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs text-center text-white transition-colors"
        >
          研判记录
        </a>
        <a
          href="/portfolio"
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-center text-white transition-colors"
        >
          资产详情
        </a>
        <a
          href="/feed"
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-center text-white transition-colors"
        >
          情报流
        </a>
      </div>
    </div>
  );
}
