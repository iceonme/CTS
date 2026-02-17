"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPAConfigManager } from "@/lib/skills/config/manager";

interface AgentConfig {
  id: string;
  name: string;
  avatar: string;
  enabled: boolean;
  schedule: {
    enabled: boolean;
    interval: number; // 分钟
  };
  skills: {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    parameters: Record<string, any>;
  }[];
  symbols: string[]; // 监控的币种
  notifications: {
    enabled: boolean;
    minImportance: "low" | "medium" | "high" | "critical";
  };
}

export default function AgentConfigPage() {
  const params = useParams();
  const agentId = params.id as string;
  
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    const paConfigManager = getPAConfigManager();
    const paConfig = paConfigManager.getConfig();

    // 根据 agentId 加载或创建配置
    const defaultConfigs: Record<string, AgentConfig> = {
      "pa": {
        id: "pa",
        name: paConfig.identity.name,
        avatar: paConfig.identity.avatar,
        enabled: true,
        schedule: { enabled: true, interval: 15 },
        skills: [
          {
            id: "pa:standard:decision",
            name: "标准研判",
            description: "基于Feed信息的快速决策流程",
            enabled: true,
            parameters: { lookbackMinutes: 15, confidenceThreshold: 0.6 },
          },
          {
            id: "pa:deep:analysis",
            name: "深度分析",
            description: "异常情况的深入分析流程",
            enabled: true,
            parameters: { lookbackMinutes: 30, confidenceThreshold: 0.5 },
          },
          {
            id: "pa:anomaly:detect",
            name: "异常检测",
            description: "识别需要深度分析的情况",
            enabled: true,
            parameters: { lookbackMinutes: 15, confidenceThreshold: 0.2 },
          },
        ],
        symbols: ["BTC", "DOGE"],
        notifications: { enabled: true, minImportance: "medium" },
      },
      "tech-analyst": {
        id: "tech-analyst",
        name: "技术分析员",
        avatar: "📊",
        enabled: true,
        schedule: { enabled: true, interval: 5 },
        skills: [
          {
            id: "tech:rsi",
            name: "RSI分析",
            description: "相对强弱指数计算与解读",
            enabled: true,
            parameters: { period: 14, overbought: 70, oversold: 30 },
          },
          {
            id: "tech:ma",
            name: "均线分析",
            description: "MA7/MA14趋势判断",
            enabled: true,
            parameters: { shortPeriod: 7, longPeriod: 14 },
          },
          {
            id: "tech:volatility",
            name: "波动率计算",
            description: "价格波动率分析",
            enabled: true,
            parameters: { period: 14 },
          },
        ],
        symbols: ["BTC", "DOGE"],
        notifications: { enabled: true, minImportance: "medium" },
      },
      "polymarket-analyst": {
        id: "polymarket-analyst",
        name: "Polymarket专员",
        avatar: "🔮",
        enabled: true,
        schedule: { enabled: true, interval: 5 },
        skills: [
          {
            id: "poly:market",
            name: "市场监控",
            description: "Polymarket数据抓取",
            enabled: true,
            parameters: { markets: ["crypto", "politics"] },
          },
          {
            id: "poly:sentiment",
            name: "情绪跟踪",
            description: "市场情绪变化分析",
            enabled: true,
            parameters: { threshold: 0.6 },
          },
        ],
        symbols: ["BTC", "ETH"],
        notifications: { enabled: true, minImportance: "high" },
      },
    };

    setConfig(defaultConfigs[agentId] || defaultConfigs["pa"]);
  }, [agentId]);

  const handleSave = () => {
    setSaveStatus("saving");
    // 实际保存逻辑（写入 localStorage 或 API）
    setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 500);
  };

  const updateSkill = (skillId: string, updates: Partial<AgentConfig["skills"][0]>) => {
    if (!config) return;
    setConfig({
      ...config,
      skills: config.skills.map((s) =>
        s.id === skillId ? { ...s, ...updates } : s
      ),
    });
  };

  if (!config) {
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
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href={`/agents/${agentId}`}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← 返回主页
              </a>
              <div>
                <h1 className="text-xl font-bold text-white">{config.name} 配置</h1>
                <p className="text-sm text-gray-400">自定义 Agent 行为和技能</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {saveStatus === "saving" && (
                <span className="text-sm text-yellow-400">保存中...</span>
              )}
              {saveStatus === "saved" && (
                <span className="text-sm text-green-400">✓ 已保存</span>
              )}
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
        {/* 基本设置 */}
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-white">基本设置</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white">启用 Agent</div>
                <div className="text-sm text-gray-500">关闭后该 Agent 将停止工作</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">名称</label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">头像</label>
                <input
                  type="text"
                  value={config.avatar}
                  onChange={(e) => setConfig({ ...config, avatar: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 定时任务 */}
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-white">定时任务</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white">自动运行</div>
                <div className="text-sm text-gray-500">按设定间隔自动执行任务</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.schedule.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      schedule: { ...config.schedule, enabled: e.target.checked },
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                执行间隔: {config.schedule.interval} 分钟
              </label>
              <input
                type="range"
                min="1"
                max="60"
                step="1"
                value={config.schedule.interval}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    schedule: { ...config.schedule, interval: parseInt(e.target.value) },
                  })
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1分钟</span>
                <span>30分钟</span>
                <span>60分钟</span>
              </div>
            </div>
          </div>
        </div>

        {/* 监控币种 */}
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-white">监控币种</h2>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {["BTC", "ETH", "DOGE", "SOL", "XRP", "ADA"].map((symbol) => (
                <label
                  key={symbol}
                  className={`px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                    config.symbols.includes(symbol)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={config.symbols.includes(symbol)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setConfig({ ...config, symbols: [...config.symbols, symbol] });
                      } else {
                        setConfig({
                          ...config,
                          symbols: config.symbols.filter((s) => s !== symbol),
                        });
                      }
                    }}
                  />
                  {symbol}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 技能配置 */}
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-white">技能配置</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {config.skills.map((skill) => (
              <div key={skill.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-white">{skill.name}</h3>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skill.enabled}
                          onChange={(e) =>
                            updateSkill(skill.id, { enabled: e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{skill.description}</p>

                    {/* 参数配置 */}
                    {skill.enabled && Object.keys(skill.parameters).length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {Object.entries(skill.parameters).map(([key, value]) => (
                          <div key={key}>
                            <label className="block text-xs text-gray-500 mb-1">
                              {key}
                            </label>
                            <input
                              type="text"
                              value={String(value)}
                              onChange={(e) =>
                                updateSkill(skill.id, {
                                  parameters: {
                                    ...skill.parameters,
                                    [key]: e.target.value,
                                  },
                                })
                              }
                              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 通知设置 */}
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-white">通知设置</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white">启用通知</div>
                <div className="text-sm text-gray-500">发布重要情报时通知</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notifications.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      notifications: { ...config.notifications, enabled: e.target.checked },
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                最低通知重要性
              </label>
              <div className="flex gap-2">
                {(["low", "medium", "high", "critical"] as const).map((level) => (
                  <label
                    key={level}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm text-center cursor-pointer transition-colors ${
                      config.notifications.minImportance === level
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="minImportance"
                      value={level}
                      checked={config.notifications.minImportance === level}
                      onChange={() =>
                        setConfig({
                          ...config,
                          notifications: { ...config.notifications, minImportance: level },
                        })
                      }
                      className="hidden"
                    />
                    {level === "low"
                      ? "低"
                      : level === "medium"
                      ? "中"
                      : level === "high"
                      ? "高"
                      : "紧急"}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
