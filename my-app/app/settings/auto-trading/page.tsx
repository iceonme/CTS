"use client";

import { useState, useEffect } from "react";
import { getAutoTrader, type AutoTradeConfig, DEFAULT_AUTO_TRADE_CONFIG } from "@/lib/trading/auto-trader";

export default function AutoTradingSettingsPage() {
  const [config, setConfig] = useState<AutoTradeConfig>(DEFAULT_AUTO_TRADE_CONFIG);
  const [executions, setExecutions] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, rejected: 0, totalAmount: 0 });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    const trader = getAutoTrader();
    setConfig(trader.getConfig());
    setExecutions(trader.getExecutions(20));
    setStats(trader.getTodayStats());
  }, []);

  const handleSave = () => {
    setSaveStatus("saving");
    const trader = getAutoTrader();
    trader.updateConfig(config);
    setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 300);
  };

  const toggleEnabled = () => {
    setConfig(prev => ({ ...prev, enabled: !prev.enabled }));
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* 头部 */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="/settings" className="text-gray-400 hover:text-white transition-colors">
                ← 返回设置
              </a>
              <div>
                <h1 className="text-xl font-bold text-white">自动交易设置</h1>
                <p className="text-sm text-gray-400">配置 PA 自动执行交易参数</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {saveStatus === "saving" && <span className="text-sm text-yellow-400">保存中...</span>}
              {saveStatus === "saved" && <span className="text-sm text-green-400">✓ 已保存</span>}
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
              >
                保存更改
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 总开关 */}
        <div className={`rounded-lg border p-6 ${config.enabled ? "bg-green-900/10 border-green-700" : "bg-gray-900 border-gray-800"}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">自动交易</h2>
              <p className="text-sm text-gray-400 mt-1">
                {config.enabled 
                  ? "✅ 已启用 - PA 将根据研判自动执行交易" 
                  : "⏸️ 已暂停 - 只生成建议，不自动执行"}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={toggleEnabled}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>

          {config.enabled && (
            <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-yellow-400 text-xl">⚠️</span>
                <div>
                  <div className="text-yellow-400 font-medium">风险提示</div>
                  <div className="text-sm text-yellow-300/80 mt-1">
                    自动交易将根据 PA 研判直接买卖资产。请确保已设置合理的风险控制参数。
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 风险控制 */}
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="font-semibold text-white">风险控制</h3>
          </div>
          <div className="p-4 space-y-4">
            {/* 最大单笔金额 */}
            <div>
              <label className="flex justify-between text-sm text-gray-400 mb-2">
                <span>最大单笔交易金额</span>
                <span className="text-white">${config.maxSingleTradeAmount}</span>
              </label>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={config.maxSingleTradeAmount}
                onChange={(e) => setConfig(prev => ({ ...prev, maxSingleTradeAmount: parseInt(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>$100</span>
                <span>$5000</span>
              </div>
            </div>

            {/* 最低置信度 */}
            <div>
              <label className="flex justify-between text-sm text-gray-400 mb-2">
                <span>最低执行置信度</span>
                <span className="text-white">{(config.minConfidence * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="0.9"
                step="0.05"
                value={config.minConfidence}
                onChange={(e) => setConfig(prev => ({ ...prev, minConfidence: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>50%</span>
                <span>90%</span>
              </div>
            </div>

            {/* 最大日交易次数 */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                最大日交易次数: {config.maxDailyTradeCount}
              </label>
              <div className="flex gap-2">
                {[3, 5, 10, 20].map(num => (
                  <button
                    key={num}
                    onClick={() => setConfig(prev => ({ ...prev, maxDailyTradeCount: num }))}
                    className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                      config.maxDailyTradeCount === num
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 交易类型 */}
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="font-semibold text-white">允许的交易类型</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white">自动买入</div>
                <div className="text-sm text-gray-500">PA 建议买入时自动执行</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.allowBuy}
                  onChange={(e) => setConfig(prev => ({ ...prev, allowBuy: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-800">
              <div>
                <div className="text-white">自动卖出</div>
                <div className="text-sm text-gray-500">PA 建议卖出/减仓时自动执行</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.allowSell}
                  onChange={(e) => setConfig(prev => ({ ...prev, allowSell: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* 自动止损止盈 */}
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="font-semibold text-white">自动止损止盈</h3>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                止损: -{config.stopLossPercent}%
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={config.stopLossPercent}
                onChange={(e) => setConfig(prev => ({ ...prev, stopLossPercent: parseInt(e.target.value) }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                止盈: +{config.takeProfitPercent}%
              </label>
              <input
                type="range"
                min="5"
                max="50"
                value={config.takeProfitPercent}
                onChange={(e) => setConfig(prev => ({ ...prev, takeProfitPercent: parseInt(e.target.value) }))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* 今日统计 */}
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="font-semibold text-white">今日执行统计</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-5 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-xs text-gray-500">总执行</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{stats.success}</div>
                <div className="text-xs text-gray-500">成功</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
                <div className="text-xs text-gray-500">失败</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">{stats.rejected}</div>
                <div className="text-xs text-gray-500">风控拦截</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">${stats.totalAmount.toFixed(0)}</div>
                <div className="text-xs text-gray-500">成交金额</div>
              </div>
            </div>
          </div>
        </div>

        {/* 最近执行记录 */}
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="font-semibold text-white">最近执行记录</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {executions.length > 0 ? (
              executions.map((exec) => (
                <div key={exec.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={
                        exec.execution.success
                          ? "text-green-400"
                          : exec.riskCheck.passed
                          ? "text-red-400"
                          : "text-yellow-400"
                      }>
                        {exec.execution.success ? "✓" : exec.riskCheck.passed ? "✗" : "⚠"}
                      </span>
                      <div>
                        <div className="text-sm text-white">
                          {exec.instruction.action === "buy" ? "买入" : "卖出"} {exec.instruction.symbol}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(exec.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {exec.execution.success ? (
                        <div className="text-sm text-white">
                          ${exec.execution.total.toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-xs text-yellow-400">
                          {exec.riskCheck.reason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                暂无执行记录
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
