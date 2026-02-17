"use client";

import { useEffect, useState } from "react";
import { getPortfolioManager, type Portfolio, type Position, type Trade } from "@/lib/trading/portfolio";

// 模拟价格数据（实际应从 API 获取）
const mockPrices: Record<string, number> = {
  BTC: 52345.67,
  DOGE: 0.1523,
  ETH: 2845.32,
  SOL: 98.45,
};

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "positions" | "history" | "allocation">("overview");

  useEffect(() => {
    const manager = getPortfolioManager();
    const data = manager.getPortfolio();
    setPortfolio(data);
    setPositions(manager.getPositions());
    setTrades(manager.getTrades(20));
  }, []);

  if (!portfolio) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  // 计算统计数据
  const totalPnl = portfolio.totalReturn;
  const totalPnlPercent = portfolio.totalReturnPercent;
  const isProfit = totalPnl >= 0;

  // 计算资产分配
  const allocation = positions.map((pos) => ({
    symbol: pos.symbol,
    value: pos.quantity * (mockPrices[pos.symbol] || pos.currentPrice),
    percentage: 0,
  }));
  const totalPositionValue = allocation.reduce((sum, item) => sum + item.value, 0);
  allocation.forEach((item) => {
    item.percentage = totalPositionValue > 0 ? (item.value / totalPositionValue) * 100 : 0;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* 头部 */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">资产管理</h1>
              <p className="text-sm text-gray-400">投资组合与交易记录</p>
            </div>
            <a
              href="/"
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              返回首页
            </a>
          </div>
        </div>
      </header>

      {/* 资产概览卡片 */}
      <div className="bg-gradient-to-b from-blue-900/20 to-gray-950 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 总资产 */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="text-sm text-gray-400">总资产 (USD)</div>
              <div className="text-2xl font-bold text-white">
                ${portfolio.totalEquity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`text-sm ${isProfit ? "text-green-400" : "text-red-400"}`}>
                {isProfit ? "+" : ""}{totalPnlPercent.toFixed(2)}%
              </div>
            </div>

            {/* 可用资金 */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="text-sm text-gray-400">可用资金</div>
              <div className="text-2xl font-bold text-white">
                ${portfolio.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm text-gray-500">
                初始: ${portfolio.initialBalance.toLocaleString()}
              </div>
            </div>

            {/* 总盈亏 */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="text-sm text-gray-400">总盈亏</div>
              <div className={`text-2xl font-bold ${isProfit ? "text-green-400" : "text-red-400"}`}>
                {isProfit ? "+" : ""}${totalPnl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm text-gray-500">
                已实现: ${portfolio.totalRealizedPnl.toFixed(2)}
              </div>
            </div>

            {/* 持仓数量 */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="text-sm text-gray-400">持仓数量</div>
              <div className="text-2xl font-bold text-white">{positions.length}</div>
              <div className="text-sm text-gray-500">
                交易次数: {portfolio.trades.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6">
            {[
              { id: "overview", label: "概览", icon: "📊" },
              { id: "positions", label: "持仓", icon: "📈" },
              { id: "allocation", label: "资产配置", icon: "🥧" },
              { id: "history", label: "交易记录", icon: "📜" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "text-blue-400 border-blue-400"
                    : "text-gray-400 border-transparent hover:text-white"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 概览 Tab */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 资产趋势图占位 */}
            <div className="lg:col-span-2 bg-gray-900 rounded-lg border border-gray-800 p-6">
              <h3 className="font-semibold text-white mb-4">资产趋势</h3>
              <div className="h-64 flex items-center justify-center bg-gray-800/50 rounded-lg">
                <div className="text-center text-gray-500">
                  <p>资产趋势图表</p>
                  <p className="text-sm mt-2">总资产: ${portfolio.totalEquity.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* 侧边栏 */}
            <div className="space-y-6">
              {/* 快速操作 */}
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <h3 className="font-semibold text-white mb-3">快速操作</h3>
                <div className="space-y-2">
                  <a
                    href="/"
                    className="block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm text-center transition-colors"
                  >
                    去交易
                  </a>
                  <a
                    href="/warroom"
                    className="block px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-center transition-colors"
                  >
                    查看市场分析
                  </a>
                </div>
              </div>

              {/* 最近交易 */}
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <h3 className="font-semibold text-white mb-3">最近交易</h3>
                <div className="space-y-2">
                  {trades.slice(0, 3).map((trade) => (
                    <div key={trade.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className={trade.side === "buy" ? "text-green-400" : "text-red-400"}>
                          {trade.side === "buy" ? "买入" : "卖出"}
                        </span>
                        <span className="text-gray-300 ml-2">{trade.symbol}</span>
                      </div>
                      <span className="text-gray-400">
                        ${trade.total.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {trades.length === 0 && (
                    <p className="text-gray-500 text-sm">暂无交易记录</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 持仓 Tab */}
        {activeTab === "positions" && (
          <div className="bg-gray-900 rounded-lg border border-gray-800">
            <div className="px-4 py-3 border-b border-gray-800">
              <h3 className="font-semibold text-white">当前持仓</h3>
            </div>
            {positions.length > 0 ? (
              <div className="divide-y divide-gray-800">
                {positions.map((pos) => {
                  const currentPrice = mockPrices[pos.symbol] || pos.currentPrice;
                  const marketValue = pos.quantity * currentPrice;
                  const pnl = pos.unrealizedPnl;
                  const pnlPercent = pos.unrealizedPnlPercent;
                  const isProfit = pnl >= 0;

                  return (
                    <div key={pos.id} className="px-4 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-2xl">
                            {pos.symbol === "BTC" ? "₿" : pos.symbol === "DOGE" ? "Ð" : "◈"}
                          </span>
                          <div>
                            <div className="font-semibold text-white">{pos.symbol}</div>
                            <div className="text-sm text-gray-500">
                              {pos.quantity.toFixed(6)} @ ${pos.avgPrice.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-white">${marketValue.toFixed(2)}</div>
                          <div className={`text-sm ${isProfit ? "text-green-400" : "text-red-400"}`}>
                            {isProfit ? "+" : ""}${pnl.toFixed(2)} ({pnlPercent.toFixed(2)}%)
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                        <span>现价: ${currentPrice.toFixed(pos.symbol === "DOGE" ? 4 : 2)}</span>
                        <span>持仓: {pos.side === "long" ? "做多" : "做空"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-12 text-center text-gray-500">
                <p>暂无持仓</p>
                <a href="/" className="text-blue-400 hover:underline mt-2 inline-block">
                  去交易 →
                </a>
              </div>
            )}
          </div>
        )}

        {/* 资产配置 Tab */}
        {activeTab === "allocation" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 饼图占位 */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <h3 className="font-semibold text-white mb-4">资产分布</h3>
              <div className="h-64 flex items-center justify-center bg-gray-800/50 rounded-lg">
                <div className="text-center text-gray-500">
                  <p>资产分布饼图</p>
                  <p className="text-sm mt-2">现金: {((portfolio.balance / portfolio.totalEquity) * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* 分配列表 */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="px-4 py-3 border-b border-gray-800">
                <h3 className="font-semibold text-white">资产详情</h3>
              </div>
              <div className="divide-y divide-gray-800">
                {/* 现金 */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">💵</span>
                    <span className="text-white">USD (现金)</span>
                  </div>
                  <div className="text-right">
                    <div className="text-white">${portfolio.balance.toFixed(2)}</div>
                    <div className="text-sm text-gray-500">
                      {((portfolio.balance / portfolio.totalEquity) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                {/* 各币种 */}
                {allocation.map((item) => (
                  <div key={item.symbol} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {item.symbol === "BTC" ? "₿" : item.symbol === "DOGE" ? "Ð" : "◈"}
                      </span>
                      <span className="text-white">{item.symbol}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-white">${item.value.toFixed(2)}</div>
                      <div className="text-sm text-gray-500">{item.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 交易记录 Tab */}
        {activeTab === "history" && (
          <div className="bg-gray-900 rounded-lg border border-gray-800">
            <div className="px-4 py-3 border-b border-gray-800">
              <h3 className="font-semibold text-white">交易记录</h3>
            </div>
            {trades.length > 0 ? (
              <div className="divide-y divide-gray-800">
                {trades.map((trade) => (
                  <div key={trade.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            trade.side === "buy" ? "bg-green-900/50" : "bg-red-900/50"
                          }`}
                        >
                          {trade.side === "buy" ? "🟢" : "🔴"}
                        </span>
                        <div>
                          <div className="text-white">
                            {trade.side === "buy" ? "买入" : "卖出"} {trade.symbol}
                          </div>
                          <div className="text-sm text-gray-500">
                            {trade.quantity.toFixed(6)} @ ${trade.price.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white">${trade.total.toFixed(2)}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(trade.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {trade.realizedPnl !== undefined && (
                      <div
                        className={`mt-2 text-sm ${
                          trade.realizedPnl >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        盈亏: {trade.realizedPnl >= 0 ? "+" : ""}${trade.realizedPnl.toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-12 text-center text-gray-500">
                <p>暂无交易记录</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
