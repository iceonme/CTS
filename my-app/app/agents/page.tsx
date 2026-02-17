"use client";

import { useEffect, useState } from "react";
import { getPAConfigManager } from "@/lib/skills/config/manager";

interface AgentProfile {
  id: string;
  name: string;
  avatar: string;
  role: string;
  description: string;
  expertise: string[];
  status: "online" | "offline" | "busy";
  feedCount: number;
  lastActive: string;
  skills: string[];
}

const agents: AgentProfile[] = [
  {
    id: "pa",
    name: "投资助手",
    avatar: "🤖",
    role: "PA",
    description: "你的个人投资助手，综合分析所有情报并给出交易建议",
    expertise: ["综合研判", "风险管理", "交易决策"],
    status: "online",
    feedCount: 0,
    lastActive: "刚刚",
    skills: ["标准研判", "深度分析", "异常检测"],
  },
  {
    id: "tech-analyst",
    name: "技术分析员",
    avatar: "📊",
    role: "分析师",
    description: "专注于技术指标分析，识别趋势和交易信号",
    expertise: ["技术指标", "趋势识别", "价格预测"],
    status: "online",
    feedCount: 0,
    lastActive: "刚刚",
    skills: ["RSI分析", "均线分析", "波动率计算"],
  },
  {
    id: "polymarket-analyst",
    name: "Polymarket专员",
    avatar: "🔮",
    role: "预测专家",
    description: "监控预测市场数据，解读市场情绪和价格预期",
    expertise: ["预测市场", "情绪分析", "事件监控"],
    status: "online",
    feedCount: 0,
    lastActive: "刚刚",
    skills: ["市场监控", "情绪跟踪", "事件预警"],
  },
];

export default function AgentsPage() {
  const [paName, setPaName] = useState("投资助手");
  const [paAvatar, setPaAvatar] = useState("🤖");

  useEffect(() => {
    const configManager = getPAConfigManager();
    const config = configManager.getConfig();
    setPaName(config.identity.name);
    setPaAvatar(config.identity.avatar);
  }, []);

  // 更新 PA 的名称和头像
  const displayAgents = agents.map(agent => 
    agent.id === "pa" 
      ? { ...agent, name: paName, avatar: paAvatar }
      : agent
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* 头部 */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">MAS 成员</h1>
              <p className="text-sm text-gray-400">多智能体分析系统成员</p>
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

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Agent 卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayAgents.map((agent) => (
            <div
              key={agent.id}
              className="bg-gray-900 rounded-lg border border-gray-800 hover:border-blue-600 transition-colors"
            >
              {/* 卡片头部 */}
              <div className="p-6 border-b border-gray-800">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{agent.avatar}</span>
                    <div>
                      <h2 className="font-semibold text-white">{agent.name}</h2>
                      <span className="text-xs text-gray-400">{agent.role}</span>
                    </div>
                  </div>
                  <span
                    className={`w-3 h-3 rounded-full ${
                      agent.status === "online"
                        ? "bg-green-500"
                        : agent.status === "busy"
                        ? "bg-yellow-500"
                        : "bg-gray-500"
                    }`}
                    title={agent.status}
                  />
                </div>
                <p className="mt-3 text-sm text-gray-400">{agent.description}</p>
              </div>

              {/* 专长标签 */}
              <div className="px-6 py-3 border-b border-gray-800">
                <div className="flex flex-wrap gap-2">
                  {agent.expertise.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* 统计信息 */}
              <div className="px-6 py-3 border-b border-gray-800">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-lg font-semibold text-white">{agent.feedCount}</div>
                    <div className="text-xs text-gray-500">发布情报</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">{agent.skills.length}</div>
                    <div className="text-xs text-gray-500">技能数量</div>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="p-4 flex gap-2">
                <a
                  href={`/agents/${agent.id}`}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm text-center transition-colors"
                >
                  查看主页
                </a>
                <a
                  href={`/agents/${agent.id}/config`}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
                >
                  ⚙️ 配置
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* 系统说明 */}
        <div className="mt-8 bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-2">关于 MAS</h3>
          <p className="text-sm text-gray-400">
            MAS (Multi-Agent System) 是一个多智能体协作分析系统。每个成员专注于不同领域的分析，
            通过 Feed 系统共享情报，最终由 PA (Personal Assistant) 综合判断并给出交易建议。
          </p>
          <div className="mt-4 flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-gray-400">在线</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
              <span className="text-gray-400">忙碌</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
              <span className="text-gray-400">离线</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
