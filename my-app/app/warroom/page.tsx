"use client";

import { useState, useEffect } from "react";
import { getCFOAgent } from "@/lib/agents/cfo";
import type { CFOAnalysis } from "@/lib/types";
import { getTechnicalAnalyst } from "@/lib/agents/tech-analyst";
import { getPolymarketAgent } from "@/lib/agents/polymarket-analyst";

interface DecisionRecord {
  id: string;
  timestamp: Date;
  symbol: string;
  bullConfidence: number;
  bearConfidence: number;
  consensusSentiment: string;
  action: string;
  summary: string;
  verified?: boolean;
  outcome?: "correct" | "incorrect" | "neutral";
}

export default function WarRoomPage() {
  const [activeTab, setActiveTab] = useState<"live" | "history">("live");
  const [currentAnalysis, setCurrentAnalysis] = useState<CFOAnalysis | null>(null);
  const [decisionHistory, setDecisionHistory] = useState<DecisionRecord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState("BTC");

  // 执行实时分析
  const runAnalysis = async () => {
    setIsAnalyzing(true);
    const cfo = getCFOAgent();
    
    try {
      const analysis = await cfo.analyzeSymbol(selectedSymbol);
      setCurrentAnalysis(analysis);
      
      // 添加到历史记录
      const record: DecisionRecord = {
        id: `decision-${Date.now()}`,
        timestamp: new Date(),
        symbol: analysis.symbol,
        bullConfidence: analysis.perspectives.bull.confidence,
        bearConfidence: analysis.perspectives.bear.confidence,
        consensusSentiment: analysis.consensus.sentiment,
        action: analysis.consensus.action,
        summary: analysis.consensus.summary,
      };
      
      setDecisionHistory(prev => [record, ...prev].slice(0, 50));
    } catch (error) {
      console.error("分析失败:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 初始分析
  useEffect(() => {
    runAnalysis();
  }, [selectedSymbol]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* 头部 */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚔️</span>
              <div>
                <h1 className="text-xl font-bold text-white">WarRoom 作战室</h1>
                <p className="text-sm text-gray-400">CFO 决策大脑可视化</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("live")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "live"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                实时思考
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "history"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                历史决策
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "live" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左侧：控制面板 */}
            <div className="lg:col-span-1 space-y-4">
              {/* 币种选择 */}
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <h3 className="text-sm font-medium text-gray-400 mb-3">选择标的</h3>
                <div className="grid grid-cols-2 gap-2">
                  {["BTC", "DOGE"].map(symbol => (
                    <button
                      key={symbol}
                      onClick={() => setSelectedSymbol(symbol)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedSymbol === symbol
                          ? "bg-blue-600 text-white"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      {symbol}
                    </button>
                  ))}
                </div>
              </div>

              {/* 正确率统计 */}
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <h3 className="text-sm font-medium text-gray-400 mb-3">正确率统计</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-green-400">🐂 Bull 正确率</span>
                    <span className="font-bold text-green-400">75%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: "75%" }}></div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-red-400">🐻 Bear 正确率</span>
                    <span className="font-bold text-red-400">60%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className="bg-red-500 h-2 rounded-full" style={{ width: "60%" }}></div>
                  </div>

                  <div className="pt-3 border-t border-gray-800">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">市场判断</span>
                      <span className="px-2 py-1 bg-green-900 text-green-400 rounded text-xs">牛市倾向</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Agent 状态 */}
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <h3 className="text-sm font-medium text-gray-400 mb-3">MAS 成员状态</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>👔</span>
                      <span className="text-sm">CFO</span>
                    </div>
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>📊</span>
                      <span className="text-sm">技术分析员</span>
                    </div>
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>🔮</span>
                      <span className="text-sm">Polymarket专员</span>
                    </div>
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧：实时分析展示 */}
            <div className="lg:col-span-2">
              {isAnalyzing ? (
                <div className="bg-gray-900 rounded-lg p-8 border border-gray-800 text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-400">CFO 正在分析 {selectedSymbol}...</p>
                </div>
              ) : currentAnalysis ? (
                <div className="space-y-4">
                  {/* 分析头部 */}
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-white">{currentAnalysis.symbol}</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          currentAnalysis.consensus.sentiment === "bullish"
                            ? "bg-green-900 text-green-400"
                            : currentAnalysis.consensus.sentiment === "bearish"
                            ? "bg-red-900 text-red-400"
                            : "bg-gray-800 text-gray-400"
                        }`}>
                          {currentAnalysis.consensus.sentiment === "bullish"
                            ? "看涨"
                            : currentAnalysis.consensus.sentiment === "bearish"
                            ? "看跌"
                            : "中性"}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-400">综合置信度</div>
                        <div className="text-xl font-bold text-blue-400">
                          {(currentAnalysis.consensus.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bull vs Bear 对战 */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Bull 阵营 */}
                    <div className="bg-gray-900 rounded-lg p-4 border border-green-800/50">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">🐂</span>
                        <h3 className="font-bold text-green-400">Bull 看多阵营</h3>
                        <span className="ml-auto text-green-400 font-bold">
                          {(currentAnalysis.perspectives.bull.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-3 mb-3">
                        <div
                          className="bg-green-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${currentAnalysis.perspectives.bull.confidence * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-300 mb-2">
                        {currentAnalysis.perspectives.bull.reasoning}
                      </p>
                      <ul className="space-y-1">
                        {currentAnalysis.perspectives.bull.keyPoints.slice(0, 3).map((point, i) => (
                          <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                            <span className="text-green-500">+</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Bear 阵营 */}
                    <div className="bg-gray-900 rounded-lg p-4 border border-red-800/50">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">🐻</span>
                        <h3 className="font-bold text-red-400">Bear 看空阵营</h3>
                        <span className="ml-auto text-red-400 font-bold">
                          {(currentAnalysis.perspectives.bear.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-3 mb-3">
                        <div
                          className="bg-red-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${currentAnalysis.perspectives.bear.confidence * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-300 mb-2">
                        {currentAnalysis.perspectives.bear.reasoning}
                      </p>
                      <ul className="space-y-1">
                        {currentAnalysis.perspectives.bear.keyPoints.slice(0, 3).map((point, i) => (
                          <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                            <span className="text-red-500">-</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 综合判断 */}
                  <div className="bg-gray-900 rounded-lg p-4 border border-blue-800/50">
                    <h3 className="font-bold text-blue-400 mb-3">🎯 CFO 综合判断</h3>
                    <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                      <p className="text-sm text-gray-200">{currentAnalysis.consensus.summary}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-xs text-gray-500">建议操作</span>
                          <div className={`font-bold ${
                            currentAnalysis.consensus.action === "buy"
                              ? "text-green-400"
                              : currentAnalysis.consensus.action === "sell"
                              ? "text-red-400"
                              : "text-yellow-400"
                          }`}>
                            {currentAnalysis.consensus.action === "buy"
                              ? "买入"
                              : currentAnalysis.consensus.action === "sell"
                              ? "卖出"
                              : currentAnalysis.consensus.action === "watch"
                              ? "观望"
                              : "持有"}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">风险等级</span>
                          <div className="font-bold text-gray-300">
                            {currentAnalysis.perspectives.bull.riskLevel === "high" || 
                             currentAnalysis.perspectives.bear.riskLevel === "high" 
                              ? "高" 
                              : "中"}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={runAnalysis}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                      >
                        重新分析
                      </button>
                    </div>
                  </div>

                  {/* 技术指标 */}
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">📊 技术指标快照</h3>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-xs text-gray-500">RSI</div>
                        <div className={`font-bold ${
                          currentAnalysis.technicalData.indicators.rsi > 70
                            ? "text-red-400"
                            : currentAnalysis.technicalData.indicators.rsi < 30
                            ? "text-green-400"
                            : "text-gray-300"
                        }`}>
                          {currentAnalysis.technicalData.indicators.rsi}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500">MA7</div>
                        <div className="font-bold text-gray-300">
                          ${currentAnalysis.technicalData.indicators.ma7.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500">MA14</div>
                        <div className="font-bold text-gray-300">
                          ${currentAnalysis.technicalData.indicators.ma14.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500">趋势</div>
                        <div className={`font-bold ${
                          currentAnalysis.technicalData.indicators.trend === "up"
                            ? "text-green-400"
                            : currentAnalysis.technicalData.indicators.trend === "down"
                            ? "text-red-400"
                            : "text-gray-400"
                        }`}>
                          {currentAnalysis.technicalData.indicators.trend === "up"
                            ? "上涨"
                            : currentAnalysis.technicalData.indicators.trend === "down"
                            ? "下跌"
                            : "横盘"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-900 rounded-lg p-8 border border-gray-800 text-center text-gray-400">
                  点击分析按钮开始
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 历史决策记录 */
          <div className="bg-gray-900 rounded-lg border border-gray-800">
            <div className="p-4 border-b border-gray-800">
              <h2 className="font-semibold text-white">历史决策记录</h2>
            </div>
            <div className="divide-y divide-gray-800">
              {decisionHistory.length > 0 ? (
                decisionHistory.map((record) => (
                  <div key={record.id} className="p-4 hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white">{record.symbol}</span>
                        <span className="text-xs text-gray-500">
                          {record.timestamp.toLocaleString()}
                        </span>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        record.consensusSentiment === "bullish"
                          ? "bg-green-900 text-green-400"
                          : record.consensusSentiment === "bearish"
                          ? "bg-red-900 text-red-400"
                          : "bg-gray-800 text-gray-400"
                      }`}>
                        {record.consensusSentiment === "bullish"
                          ? "看涨"
                          : record.consensusSentiment === "bearish"
                          ? "看跌"
                          : "中性"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Bull:</span>
                        <span className="ml-2 text-green-400">
                          {(record.bullConfidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Bear:</span>
                        <span className="ml-2 text-red-400">
                          {(record.bearConfidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">操作:</span>
                        <span className={`ml-2 ${
                          record.action === "buy"
                            ? "text-green-400"
                            : record.action === "sell"
                            ? "text-red-400"
                            : "text-yellow-400"
                        }`}>
                          {record.action === "buy"
                            ? "买入"
                            : record.action === "sell"
                            ? "卖出"
                            : record.action === "watch"
                            ? "观望"
                            : "持有"}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-400">{record.summary}</p>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  暂无历史决策记录
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
