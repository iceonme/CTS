"use client";

import { useState, useEffect } from "react";
import { getCFOAgent } from "@/lib/agents/cfo";
import { getPAConfigManager } from "@/lib/skills/config/manager";
import { getFeedItems, subscribeToFeed } from "@/lib/feed/publisher";
import { getPortfolioManager } from "@/lib/trading/portfolio";
import { getAutoTrader, type AutoTradeExecution } from "@/lib/trading/auto-trader";
import type { PATask } from "@/lib/types/pa-task";
import type { IntelligenceItem } from "@/lib/types";

export default function WarRoomPage() {
  const [tasks, setTasks] = useState<PATask[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [paName, setPaName] = useState("投资助手");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 加载配置和初始数据
  useEffect(() => {
    const configManager = getPAConfigManager();
    const config = configManager.getConfig();
    setPaName(config.identity.name);

    // 生成初始任务数据
    generateMockTasks();

    // 订阅新的 Feed，触发新任务
    const unsubscribe = subscribeToFeed((feed) => {
      // 当收到新的 PA 分析 Feed 时，可以创建新任务
      if (feed.type === "pa_analysis") {
        // 实际应用中这里会触发新的任务分析
      }
    });

    return () => unsubscribe();
  }, []);

  // 生成模拟任务数据（实际应用从后端获取）
  const generateMockTasks = () => {
    const portfolio = getPortfolioManager().getPortfolio();
    const positions = getPortfolioManager().getPositions();
    
    const mockTasks: PATask[] = [
      {
        id: `task-${Date.now()}`,
        timestamp: new Date(),
        type: "scheduled",
        status: "running",
        feedsRead: [
          { agent: "技术分析员", count: 2, highlights: ["BTC RSI=65 中性", "DOGE RSI=45 偏弱"] },
          { agent: "Polymarket专员", count: 1, highlights: ["BTC ETF 情绪看涨 72%"] },
        ],
        anomalyCheck: {
          checked: true,
          anomaliesFound: 0,
          details: [],
        },
        analysis: {
          portfolioSnapshot: {
            totalValue: portfolio.totalEquity,
            positions: positions.map(p => ({
              symbol: p.symbol,
              value: p.quantity * p.currentPrice,
              pnl: p.unrealizedPnl,
            })),
          },
          marketSentiment: "neutral",
          keyInsights: ["市场整体横盘", "BTC技术面中性", "DOGE相对弱势"],
          risks: ["DOGE持仓亏损-5%", "市场整体波动率上升"],
          opportunities: ["BTC若突破$53k可加仓", "DOGE超跌反弹机会"],
        },
        tradingInstructions: [
          { symbol: "BTC", action: "hold", percentage: 20, confidence: 0.65, reasoning: "技术面中性，观望为主", executed: false },
          { symbol: "DOGE", action: "reduce", percentage: 10, confidence: 0.55, reasoning: "弱势格局，减仓避险", executed: false },
        ],
      },
      {
        id: `task-${Date.now() - 15 * 60 * 1000}`,
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        type: "anomaly",
        status: "completed",
        feedsRead: [
          { agent: "技术分析员", count: 2, highlights: ["BTC 15分钟涨3%", "突破MA7"] },
          { agent: "Polymarket专员", count: 1, highlights: ["看涨情绪急剧上升"] },
        ],
        anomalyCheck: {
          checked: true,
          anomaliesFound: 1,
          details: ["BTC 15分钟内涨幅超过3%"],
        },
        analysis: {
          portfolioSnapshot: {
            totalValue: 10500,
            positions: [
              { symbol: "BTC", value: 3000, pnl: 150 },
              { symbol: "DOGE", value: 800, pnl: -50 },
            ],
          },
          marketSentiment: "bullish",
          keyInsights: ["BTC突破短期均线", "市场情绪转暖", "量价配合良好"],
          risks: ["追涨风险", "可能假突破"],
          opportunities: ["BTC momentum 延续", "若回调至$51k可加仓"],
        },
        tradingInstructions: [
          { symbol: "BTC", action: "buy", percentage: 15, confidence: 0.72, reasoning: "突破信号明确，追涨10%仓位", executed: true },
          { symbol: "DOGE", action: "hold", percentage: 10, confidence: 0.45, reasoning: "资金优先配置BTC", executed: false },
        ],
        execution: {
          time: new Date(Date.now() - 14 * 60 * 1000),
          orders: [{ symbol: "BTC", side: "buy", amount: 0.05, status: "filled" }],
        },
        autoTradeExecutions: [
          {
            id: "auto-001",
            taskId: `task-${Date.now() - 15 * 60 * 1000}`,
            timestamp: new Date(Date.now() - 14 * 60 * 1000),
            instruction: {
              symbol: "BTC",
              action: "buy",
              percentage: 15,
              confidence: 0.72,
            },
            execution: {
              success: true,
              amount: 0.05,
              price: 52345.67,
              total: 2617.28,
              fee: 2.62,
            },
            riskCheck: { passed: true },
            config: getAutoTrader().getConfig(),
          },
        ],
      },
      {
        id: `task-${Date.now() - 30 * 60 * 1000}`,
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        type: "scheduled",
        status: "completed",
        feedsRead: [
          { agent: "技术分析员", count: 2, highlights: ["BTC RSI=58", "DOGE RSI=42"] },
          { agent: "Polymarket专员", count: 1, highlights: ["市场情绪中性偏空"] },
        ],
        anomalyCheck: {
          checked: true,
          anomaliesFound: 0,
          details: [],
        },
        analysis: {
          portfolioSnapshot: {
            totalValue: 10200,
            positions: [
              { symbol: "BTC", value: 2500, pnl: 50 },
              { symbol: "DOGE", value: 800, pnl: -80 },
            ],
          },
          marketSentiment: "neutral",
          keyInsights: ["市场横盘整理", "DOGE持续弱势", "BTC相对抗跌"],
          risks: ["DOGE可能继续下跌", "市场整体缺乏方向"],
          opportunities: [],
        },
        tradingInstructions: [
          { symbol: "BTC", action: "hold", percentage: 20, confidence: 0.55, reasoning: "观望为主", executed: false },
          { symbol: "DOGE", action: "sell", percentage: 50, confidence: 0.60, reasoning: "弱势格局，减仓一半", executed: true },
        ],
        execution: {
          time: new Date(Date.now() - 29 * 60 * 1000),
          orders: [{ symbol: "DOGE", side: "sell", amount: 1000, status: "filled" }],
        },
      },
    ];

    setTasks(mockTasks);
    setExpandedTaskId(mockTasks[0].id); // 默认展开最新任务
  };

  // 手动触发一次 Portfolio 分析
  const runManualAnalysis = async () => {
    setIsAnalyzing(true);
    // 模拟分析过程
    await new Promise(resolve => setTimeout(resolve, 2000));
    generateMockTasks();
    setIsAnalyzing(false);
  };

  const getTaskTypeLabel = (type: PATask["type"]) => {
    switch (type) {
      case "scheduled": return { text: "定时研判", color: "bg-blue-900 text-blue-400" };
      case "anomaly": return { text: "异常响应", color: "bg-red-900 text-red-400" };
      case "manual": return { text: "手动触发", color: "bg-purple-900 text-purple-400" };
      case "portfolio_review": return { text: "组合复盘", color: "bg-green-900 text-green-400" };
    }
  };

  const getStatusIcon = (status: PATask["status"]) => {
    switch (status) {
      case "running": return "⏳";
      case "completed": return "✅";
      case "failed": return "❌";
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* 头部 */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚔️</span>
              <div>
                <h1 className="text-xl font-bold text-white">WarRoom 作战室</h1>
                <p className="text-sm text-gray-400">{paName} 任务执行记录</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={runManualAnalysis}
                disabled={isAnalyzing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    分析中...
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    立即研判
                  </>
                )}
              </button>
              <a
                href="/settings"
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
              >
                ⚙️ 配置
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* 任务流时间线 */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="space-y-4">
          {tasks.map((task, index) => {
            const isExpanded = expandedTaskId === task.id;
            const typeLabel = getTaskTypeLabel(task.type);

            return (
              <div
                key={task.id}
                className={`bg-gray-900 rounded-lg border transition-all ${
                  isExpanded ? "border-blue-600" : "border-gray-800 hover:border-gray-700"
                }`}
              >
                {/* 任务头部 - 始终显示 */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{getStatusIcon(task.status)}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${typeLabel.color}`}>
                            {typeLabel.text}
                          </span>
                          <span className="text-sm text-gray-500">
                            {task.timestamp.toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-400">
                          读取 {task.feedsRead.reduce((sum, f) => sum + f.count, 0)} 条情报
                          {task.anomalyCheck.anomaliesFound > 0 && (
                            <span className="ml-2 text-red-400">
                              · 发现 {task.anomalyCheck.anomaliesFound} 个异常
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 交易指令概览（重点突出） */}
                    <div className="flex items-center gap-4">
                      <div className="flex gap-2">
                        {task.tradingInstructions.map((inst, i) => (
                          <div
                            key={i}
                            className={`px-3 py-2 rounded-lg text-center min-w-[80px] ${
                              inst.action === "buy"
                                ? "bg-green-900/50 border border-green-700"
                                : inst.action === "sell" || inst.action === "reduce"
                                ? "bg-red-900/50 border border-red-700"
                                : "bg-gray-800 border border-gray-700"
                            }`}
                          >
                            <div className={`text-sm font-bold ${
                              inst.action === "buy"
                                ? "text-green-400"
                                : inst.action === "sell" || inst.action === "reduce"
                                ? "text-red-400"
                                : "text-yellow-400"
                            }`}>
                              {inst.action === "buy" && "买入"}
                              {inst.action === "sell" && "卖出"}
                              {inst.action === "reduce" && "减仓"}
                              {inst.action === "hold" && "持有"}
                            </div>
                            <div className="text-xs text-gray-400">
                              {inst.symbol} {inst.percentage}%
                            </div>
                            {inst.executed && (
                              <div className="text-xs text-green-500 mt-1">✓ 已执行</div>
                            )}
                          </div>
                        ))}
                      </div>
                      <span className="text-gray-500">{isExpanded ? "▼" : "▶"}</span>
                    </div>
                  </div>
                </div>

                {/* 展开详情 */}
                {isExpanded && (
                  <div className="border-t border-gray-800 p-4 space-y-6">
                    {/* Step 1: 读取 Feed */}
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-900 text-blue-400 flex items-center justify-center text-sm font-bold shrink-0">
                        1
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-white mb-2">读取情报 Feed</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {task.feedsRead.map((feed, i) => (
                            <div key={i} className="bg-gray-800 rounded-lg p-3">
                              <div className="text-sm text-gray-400">{feed.agent}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {feed.count} 条情报
                              </div>
                              <div className="mt-2 space-y-1">
                                {feed.highlights.map((h, j) => (
                                  <div key={j} className="text-xs text-blue-400">• {h}</div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Step 2: 异常检测 */}
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-yellow-900 text-yellow-400 flex items-center justify-center text-sm font-bold shrink-0">
                        2
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-white mb-2">异常检测</h3>
                        {task.anomalyCheck.anomaliesFound > 0 ? (
                          <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
                            <div className="text-red-400 font-medium">
                              ⚠️ 发现 {task.anomalyCheck.anomaliesFound} 个异常
                            </div>
                            {task.anomalyCheck.details.map((d, i) => (
                              <div key={i} className="text-sm text-red-300 mt-1">• {d}</div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-gray-800 rounded-lg p-3 text-gray-400">
                            ✅ 未发现异常，执行标准研判流程
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 3: Portfolio 分析 */}
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-purple-900 text-purple-400 flex items-center justify-center text-sm font-bold shrink-0">
                        3
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-white mb-2">Portfolio 综合分析</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-800 rounded-lg p-3">
                            <div className="text-sm text-gray-400">资产快照</div>
                            <div className="text-lg font-bold text-white">
                              ${task.analysis.portfolioSnapshot.totalValue.toLocaleString()}
                            </div>
                            <div className="mt-2 space-y-1">
                              {task.analysis.portfolioSnapshot.positions.map((p, i) => (
                                <div key={i} className="text-xs flex justify-between">
                                  <span className="text-gray-400">{p.symbol}</span>
                                  <span className={p.pnl >= 0 ? "text-green-400" : "text-red-400"}>
                                    {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(0)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="bg-gray-800 rounded-lg p-3">
                              <div className="text-sm text-gray-400">市场情绪</div>
                              <span className={`inline-block mt-1 px-2 py-1 rounded text-xs ${
                                task.analysis.marketSentiment === "bullish"
                                  ? "bg-green-900 text-green-400"
                                  : task.analysis.marketSentiment === "bearish"
                                  ? "bg-red-900 text-red-400"
                                  : "bg-gray-700 text-gray-400"
                              }`}>
                                {task.analysis.marketSentiment === "bullish" ? "看涨" : task.analysis.marketSentiment === "bearish" ? "看跌" : "中性"}
                              </span>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-3">
                              <div className="text-sm text-gray-400">关键洞察</div>
                              {task.analysis.keyInsights.map((insight, i) => (
                                <div key={i} className="text-xs text-gray-300 mt-1">• {insight}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        {/* 风险与机会 */}
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-3">
                            <div className="text-sm text-red-400 font-medium">⚠️ 风险</div>
                            {task.analysis.risks.map((r, i) => (
                              <div key={i} className="text-xs text-red-300 mt-1">• {r}</div>
                            ))}
                          </div>
                          <div className="bg-green-900/20 border border-green-900/50 rounded-lg p-3">
                            <div className="text-sm text-green-400 font-medium">💡 机会</div>
                            {task.analysis.opportunities.length > 0 ? (
                              task.analysis.opportunities.map((o, i) => (
                                <div key={i} className="text-xs text-green-300 mt-1">• {o}</div>
                              ))
                            ) : (
                              <div className="text-xs text-gray-500 mt-1">暂无明显机会</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 4: 交易指令（重点突出） */}
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-green-900 text-green-400 flex items-center justify-center text-sm font-bold shrink-0">
                        4
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-white mb-2">🎯 交易指令</h3>
                        <div className="space-y-3">
                          {task.tradingInstructions.map((inst, i) => (
                            <div
                              key={i}
                              className={`rounded-lg border p-4 ${
                                inst.action === "buy"
                                  ? "bg-green-900/20 border-green-700"
                                  : inst.action === "sell" || inst.action === "reduce"
                                  ? "bg-red-900/20 border-red-700"
                                  : "bg-gray-800 border-gray-700"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <span className="text-2xl">
                                    {inst.action === "buy" ? "🟢" : inst.action === "sell" || inst.action === "reduce" ? "🔴" : "🟡"}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-lg font-bold ${
                                        inst.action === "buy"
                                          ? "text-green-400"
                                          : inst.action === "sell" || inst.action === "reduce"
                                          ? "text-red-400"
                                          : "text-yellow-400"
                                      }`}>
                                        {inst.action === "buy" && "买入"}
                                        {inst.action === "sell" && "卖出"}
                                        {inst.action === "reduce" && "减仓"}
                                        {inst.action === "hold" && "持有"}
                                      </span>
                                      <span className="text-white font-bold">{inst.symbol}</span>
                                    </div>
                                    <div className="text-sm text-gray-400">
                                      建议仓位: {inst.percentage}% | 置信度: {(inst.confidence * 100).toFixed(0)}%
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {!inst.executed && inst.action !== "hold" && (
                                    <a
                                      href="/"
                                      className={`inline-block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        inst.action === "buy"
                                          ? "bg-green-600 hover:bg-green-700 text-white"
                                          : "bg-red-600 hover:bg-red-700 text-white"
                                      }`}
                                    >
                                      执行 →
                                    </a>
                                  )}
                                  {inst.executed && (
                                    <span className="text-green-500 text-sm">✓ 已执行</span>
                                  )}
                                  {inst.action === "hold" && (
                                    <span className="text-gray-500 text-sm">观望</span>
                                  )}
                                </div>
                              </div>
                              <div className="mt-2 text-sm text-gray-400 bg-gray-900/50 rounded p-2">
                                💡 {inst.reasoning}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Step 5: 自动交易执行状态 */}
                    {task.autoTradeExecutions && task.autoTradeExecutions.length > 0 && (
                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-blue-900 text-blue-400 flex items-center justify-center text-sm font-bold shrink-0">
                          5
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-white mb-2">🤖 自动交易执行</h3>
                          <div className="space-y-2">
                            {task.autoTradeExecutions.map((exec, i) => (
                              <div
                                key={i}
                                className={`rounded-lg border p-3 ${
                                  exec.execution.success
                                    ? "bg-green-900/20 border-green-700"
                                    : exec.riskCheck.passed
                                    ? "bg-red-900/20 border-red-700"
                                    : "bg-yellow-900/20 border-yellow-700"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={
                                      exec.execution.success
                                        ? "text-green-400"
                                        : exec.riskCheck.passed
                                        ? "text-red-400"
                                        : "text-yellow-400"
                                    }>
                                      {exec.execution.success ? "✓" : exec.riskCheck.passed ? "✗" : "⚠"}
                                    </span>
                                    <span className="text-sm text-white">
                                      {exec.execution.success
                                        ? "执行成功"
                                        : exec.riskCheck.passed
                                        ? "执行失败"
                                        : "风控拦截"}
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {new Date(exec.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                                {exec.execution.success ? (
                                  <div className="mt-2 text-sm text-gray-300">
                                    {exec.instruction.action === "buy" ? "买入" : "卖出"} {exec.instruction.symbol} {exec.execution.amount.toFixed(6)}
                                    <span className="text-gray-500"> @ ${exec.execution.price.toFixed(2)}</span>
                                    <div className="text-xs text-gray-500 mt-1">
                                      金额: ${exec.execution.total.toFixed(2)} | 手续费: ${exec.execution.fee.toFixed(2)}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-2 text-sm text-yellow-400">
                                    原因: {exec.riskCheck.reason}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 6: 手动执行结果（如果有） */}
                    {task.execution && (
                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-gray-700 text-gray-400 flex items-center justify-center text-sm font-bold shrink-0">
                          {task.autoTradeExecutions ? "6" : "5"}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-white mb-2">执行结果</h3>
                          <div className="bg-gray-800 rounded-lg p-3">
                            <div className="text-sm text-gray-400">
                              执行时间: {task.execution.time.toLocaleString()}
                            </div>
                            <div className="mt-2 space-y-1">
                              {task.execution.orders.map((order, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                  <span className={order.side === "buy" ? "text-green-400" : "text-red-400"}>
                                    {order.side === "buy" ? "买入" : "卖出"}
                                  </span>
                                  <span className="text-white">{order.symbol}</span>
                                  <span className="text-gray-400">{order.amount}</span>
                                  <span className="text-green-500 text-xs">({order.status})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 底部说明 */}
        <div className="mt-8 bg-gray-900 rounded-lg border border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">关于 WarRoom</h3>
          <p className="text-sm text-gray-500">
            WarRoom 记录 {paName} 每一次 Portfolio 级别研判任务的完整过程。
            每个任务从读取情报、异常检测、综合分析到生成交易指令，全程可追溯。
            定时任务每15分钟执行一次，异常情况会立即触发深度分析。
          </p>
        </div>
      </main>
    </div>
  );
}
