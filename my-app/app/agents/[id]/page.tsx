"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getFeedItems } from "@/lib/feed/publisher";
import { getPAConfigManager } from "@/lib/skills/config/manager";
import type { IntelligenceItem } from "@/lib/types";

interface AgentInfo {
  id: string;
  name: string;
  avatar: string;
  role: string;
  description: string;
  expertise: string[];
  skills: { name: string; description: string; enabled: boolean }[];
  schedule: { task: string; interval: string; lastRun?: string }[];
  performance: {
    accuracy: number;
    totalCalls: number;
    successRate: number;
  };
}

const agentDefaults: Record<string, Omit<AgentInfo, "name" | "avatar">> = {
  "pa": {
    id: "pa",
    role: "PA",
    description: "你的个人投资助手，综合分析所有情报并给出交易建议",
    expertise: ["综合研判", "风险管理", "交易决策"],
    skills: [
      { name: "标准研判", description: "基于Feed信息的快速决策流程", enabled: true },
      { name: "深度分析", description: "异常情况的深入分析流程", enabled: true },
      { name: "异常检测", description: "识别需要深度分析的情况", enabled: true },
      { name: "交易执行", description: "自动执行买入/卖出交易", enabled: false },
    ],
    schedule: [
      { task: "综合研判", interval: "每15分钟", lastRun: "刚刚" },
    ],
    performance: { accuracy: 0.75, totalCalls: 128, successRate: 0.82 },
  },
  "tech-analyst": {
    id: "tech-analyst",
    role: "分析师",
    description: "专注于技术指标分析，识别趋势和交易信号",
    expertise: ["技术指标", "趋势识别", "价格预测"],
    skills: [
      { name: "RSI分析", description: "相对强弱指数计算与解读", enabled: true },
      { name: "均线分析", description: "MA7/MA14趋势判断", enabled: true },
      { name: "波动率计算", description: "价格波动率分析", enabled: true },
    ],
    schedule: [
      { task: "技术分析", interval: "每5分钟", lastRun: "刚刚" },
    ],
    performance: { accuracy: 0.72, totalCalls: 256, successRate: 0.78 },
  },
  "polymarket-analyst": {
    id: "polymarket-analyst",
    role: "预测专家",
    description: "监控预测市场数据，解读市场情绪和价格预期",
    expertise: ["预测市场", "情绪分析", "事件监控"],
    skills: [
      { name: "市场监控", description: "Polymarket数据抓取", enabled: true },
      { name: "情绪跟踪", description: "市场情绪变化分析", enabled: true },
      { name: "事件预警", description: "重大事件预警", enabled: true },
    ],
    schedule: [
      { task: "市场监控", interval: "每5分钟", lastRun: "刚刚" },
    ],
    performance: { accuracy: 0.68, totalCalls: 192, successRate: 0.71 },
  },
};

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;
  
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [feeds, setFeeds] = useState<IntelligenceItem[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "feeds" | "skills" | "performance">("overview");

  useEffect(() => {
    // 加载 PA 配置
    const configManager = getPAConfigManager();
    const config = configManager.getConfig();
    
    // 构建 Agent 信息
    const defaults = agentDefaults[agentId];
    if (defaults) {
      setAgent({
        ...defaults,
        name: agentId === "pa" ? config.identity.name : 
              agentId === "tech-analyst" ? "技术分析员" : "Polymarket专员",
        avatar: agentId === "pa" ? config.identity.avatar :
                agentId === "tech-analyst" ? "📊" : "🔮",
      });
    }

    // 加载该 Agent 的 Feed
    const allFeeds = getFeedItems({ limit: 50 });
    const agentFeeds = allFeeds.filter(f => {
      if (agentId === "pa") return f.type === "pa_analysis";
      if (agentId === "tech-analyst") return f.type === "technical_signal";
      if (agentId === "polymarket-analyst") return f.type === "sentiment_shift";
      return false;
    });
    setFeeds(agentFeeds);
  }, [agentId]);

  if (!agent) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* 头部 */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="/agents" className="text-gray-400 hover:text-white transition-colors">
                ← 返回成员列表
              </a>
            </div>
            <a
              href={`/agents/${agentId}/config`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
            >
              ⚙️ 配置
            </a>
          </div>
        </div>
      </header>

      {/* Agent 资料头部 */}
      <div className="bg-gradient-to-b from-blue-900/20 to-gray-950 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-start gap-6">
            <span className="text-6xl">{agent.avatar}</span>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
                <span className="px-2 py-1 bg-blue-900 text-blue-300 rounded text-xs">
                  {agent.role}
                </span>
              </div>
              <p className="mt-2 text-gray-400">{agent.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {agent.expertise.map((exp) => (
                  <span
                    key={exp}
                    className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-300"
                  >
                    {exp}
                  </span>
                ))}
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
              { id: "feeds", label: "情报", icon: "📰" },
              { id: "skills", label: "技能", icon: "⚡" },
              { id: "performance", label: "表现", icon: "📈" },
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
            {/* 统计卡片 */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <div className="text-2xl font-bold text-white">
                    {agent.performance.totalCalls}
                  </div>
                  <div className="text-sm text-gray-500">总分析次数</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <div className="text-2xl font-bold text-green-400">
                    {(agent.performance.accuracy * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-500">准确率</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <div className="text-2xl font-bold text-blue-400">
                    {feeds.length}
                  </div>
                  <div className="text-sm text-gray-500">发布情报</div>
                </div>
              </div>

              {/* 定时任务 */}
              <div className="bg-gray-900 rounded-lg border border-gray-800">
                <div className="px-4 py-3 border-b border-gray-800">
                  <h3 className="font-semibold text-white">定时任务</h3>
                </div>
                <div className="divide-y divide-gray-800">
                  {agent.schedule.map((task, index) => (
                    <div key={index} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-white">{task.task}</div>
                        <div className="text-sm text-gray-500">{task.interval}</div>
                      </div>
                      <span className="text-xs text-green-400">{task.lastRun}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 侧边栏 */}
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <h3 className="font-semibold text-white mb-3">快捷操作</h3>
                <div className="space-y-2">
                  <a
                    href="/feed"
                    className="block px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-center transition-colors"
                  >
                    查看 Feed 流
                  </a>
                  <a
                    href="/warroom"
                    className="block px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-center transition-colors"
                  >
                    进入 WarRoom
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 情报 Tab */}
        {activeTab === "feeds" && (
          <div className="space-y-4">
            {feeds.length > 0 ? (
              feeds.map((feed) => (
                <div
                  key={feed.id}
                  className="bg-gray-900 rounded-lg p-4 border border-gray-800"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-white">{feed.title}</h3>
                      <div className="text-xs text-gray-500 mt-1">
                        {feed.symbol} · {new Date(feed.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        feed.importance === "high"
                          ? "bg-red-900 text-red-400"
                          : feed.importance === "medium"
                          ? "bg-blue-900 text-blue-400"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {feed.importance}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-gray-300">{feed.content}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>暂无发布的情报</p>
                <p className="text-sm mt-2">定时任务会自动发布情报到 Feed</p>
              </div>
            )}
          </div>
        )}

        {/* 技能 Tab */}
        {activeTab === "skills" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agent.skills.map((skill, index) => (
              <div
                key={index}
                className="bg-gray-900 rounded-lg p-4 border border-gray-800"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-white">{skill.name}</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skill.enabled}
                      readOnly
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="mt-2 text-sm text-gray-400">{skill.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* 表现 Tab */}
        {activeTab === "performance" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <h3 className="font-semibold text-white mb-4">准确率趋势</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">本月</span>
                    <span className="text-green-400">{((agent.performance.accuracy + 0.05) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${(agent.performance.accuracy + 0.05) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">上月</span>
                    <span className="text-blue-400">{(agent.performance.accuracy * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${agent.performance.accuracy * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">总体</span>
                    <span className="text-yellow-400">{((agent.performance.accuracy - 0.03) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${(agent.performance.accuracy - 0.03) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <h3 className="font-semibold text-white mb-4">成功率统计</h3>
              <div className="text-center py-8">
                <div className="text-5xl font-bold text-blue-400">
                  {(agent.performance.successRate * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-500 mt-2">任务成功率</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
