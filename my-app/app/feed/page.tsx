"use client";

import { useState, useEffect } from "react";
import { getFeedItems, subscribeToFeed, triggerAllJobs } from "@/lib/feed/publisher";
import type { IntelligenceItem } from "@/lib/types";

export default function FeedPage() {
  const [feedItems, setFeedItems] = useState<IntelligenceItem[]>([]);
  const [filter, setFilter] = useState<{
    symbol?: string;
    type?: string;
  }>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 加载 Feed 数据
  const loadFeed = () => {
    const items = getFeedItems({
      limit: 50,
      symbol: filter.symbol,
      type: filter.type,
    });
    setFeedItems(items);
  };

  // 初始加载和订阅
  useEffect(() => {
    loadFeed();
    
    // 订阅实时更新
    const unsubscribe = subscribeToFeed((newItem) => {
      setFeedItems(prev => [newItem, ...prev].slice(0, 50));
    });

    return () => unsubscribe();
  }, [filter]);

  // 手动刷新
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await triggerAllJobs();
    loadFeed();
    setIsRefreshing(false);
  };

  // 获取类型图标
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "technical_signal":
        return "📊";
      case "cfo_analysis":
        return "👔";
      case "sentiment_shift":
        return "🔮";
      case "price_alert":
        return "🔔";
      default:
        return "📰";
    }
  };

  // 获取类型标签
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "technical_signal":
        return "技术分析";
      case "cfo_analysis":
        return "CFO研判";
      case "sentiment_shift":
        return "预测市场";
      case "price_alert":
        return "价格提醒";
      default:
        return "情报";
    }
  };

  // 获取重要性颜色
  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case "critical":
        return "bg-red-900 text-red-400 border-red-800";
      case "high":
        return "bg-orange-900 text-orange-400 border-orange-800";
      case "medium":
        return "bg-blue-900 text-blue-400 border-blue-800";
      default:
        return "bg-gray-800 text-gray-400 border-gray-700";
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* 头部 */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📜</span>
              <div>
                <h1 className="text-xl font-bold text-white">Feed 情报流</h1>
                <p className="text-sm text-gray-400">MAS 成员实时情报</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                {isRefreshing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    刷新中...
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    立即刷新
                  </>
                )}
              </button>
              <a
                href="/"
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                返回首页
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 过滤器 */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">标的:</span>
              <select
                value={filter.symbol || ""}
                onChange={(e) => setFilter(prev => ({ ...prev, symbol: e.target.value || undefined }))}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">全部</option>
                <option value="BTC">BTC</option>
                <option value="DOGE">DOGE</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">类型:</span>
              <select
                value={filter.type || ""}
                onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value || undefined }))}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">全部</option>
                <option value="technical_signal">技术分析</option>
                <option value="cfo_analysis">CFO研判</option>
                <option value="sentiment_shift">预测市场</option>
              </select>
            </div>
            <button
              onClick={() => setFilter({})}
              className="ml-auto px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              清除筛选
            </button>
          </div>
        </div>

        {/* Feed 列表 */}
        <div className="space-y-4">
          {feedItems.length > 0 ? (
            feedItems.map((item) => (
              <div
                key={item.id}
                className={`bg-gray-900 rounded-lg p-4 border transition-colors hover:bg-gray-800/50 ${
                  item.importance === "critical"
                    ? "border-red-800"
                    : item.importance === "high"
                    ? "border-orange-800"
                    : "border-gray-800"
                }`}
              >
                {/* 头部 */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getTypeIcon(item.type)}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{item.title}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${getImportanceColor(item.importance)}`}>
                          {getTypeLabel(item.type)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span>{item.symbol}</span>
                        <span>·</span>
                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 内容 */}
                <div className="ml-11">
                  <div className="text-sm text-gray-300 whitespace-pre-wrap">
                    {item.content}
                  </div>

                  {/* 数据标签 */}
                  {item.data && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(item.data as Record<string, unknown>).rsi !== undefined && (
                        <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
                          RSI: {(item.data as Record<string, unknown>).rsi as number}
                        </span>
                      )}
                      {(item.data as Record<string, unknown>).confidence !== undefined && (
                        <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
                          置信度: {(((item.data as Record<string, unknown>).confidence as number) * 100).toFixed(0)}%
                        </span>
                      )}
                      {(item.data as Record<string, unknown>).source !== undefined && (
                        <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
                          来源: {(item.data as Record<string, unknown>).source as string}
                        </span>
                      )}
                    </div>
                  )}

                  {/* CFO 分析特有的 Bull/Bear 指示 */}
                  {(item.data as Record<string, unknown>)?.bullConfidence !== undefined && (
                    <div className="flex gap-2 mt-3">
                      <div className="flex-1 bg-green-900/30 rounded p-2 text-center">
                        <div className="text-xs text-green-400">🐂 Bull</div>
                        <div className="text-sm font-bold text-green-300">
                          {(((item.data as Record<string, unknown>).bullConfidence as number) * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="flex-1 bg-red-900/30 rounded p-2 text-center">
                        <div className="text-xs text-red-400">🐻 Bear</div>
                        <div className="text-sm font-bold text-red-300">
                          {(((item.data as Record<string, unknown>).bearConfidence as number) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-gray-900 rounded-lg p-8 border border-gray-800 text-center">
              <p className="text-gray-400 mb-4">暂无情报数据</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                立即获取情报
              </button>
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>数据分析员每5分钟更新 · Polymarket专员每5分钟更新 · CFO每15分钟研判</p>
        </div>
      </main>
    </div>
  );
}
