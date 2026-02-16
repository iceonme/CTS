"use client";

import { useState, useEffect } from "react";
import { getConfigManager } from "@/lib/skills/config/manager";
import type { SkillConfig, CFOGlobalConfig, ConfigChangeEvent } from "@/lib/skills/config/types";

export default function SkillConfigPanel() {
  const [activeTab, setActiveTab] = useState<"skills" | "global" | "versions">("skills");
  const [configManager] = useState(() => getConfigManager());
  const [config, setConfig] = useState(configManager.getConfig());
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // 订阅配置变更
  useEffect(() => {
    const unsubscribe = configManager.subscribe((event: ConfigChangeEvent) => {
      console.log("[SkillConfig] Config changed:", event);
      setConfig(configManager.getConfig());
    });
    return unsubscribe;
  }, [configManager]);

  // 获取选中的 Skill
  const selectedSkill = selectedSkillId 
    ? config.skills.find(s => s.id === selectedSkillId)
    : null;

  // 更新 Skill 配置
  const handleSkillUpdate = (skillId: string, updates: Partial<SkillConfig>) => {
    setSaveStatus("saving");
    configManager.updateSkillConfig(skillId, updates);
    setTimeout(() => setSaveStatus("saved"), 300);
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  // 更新全局配置
  const handleGlobalUpdate = (updates: Partial<CFOGlobalConfig>) => {
    setSaveStatus("saving");
    configManager.updateGlobalConfig(updates);
    setTimeout(() => setSaveStatus("saved"), 300);
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  // 切换 Skill 启用状态
  const toggleSkill = (skillId: string, enabled: boolean) => {
    configManager.toggleSkill(skillId, enabled);
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">⚙️ CFO 配置</h2>
        <div className="flex items-center gap-2">
          {saveStatus === "saving" && (
            <span className="text-xs text-yellow-400">保存中...</span>
          )}
          {saveStatus === "saved" && (
            <span className="text-xs text-green-400">✓ 已保存</span>
          )}
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-4 border-b border-gray-800">
        <button
          onClick={() => setActiveTab("skills")}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "skills"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Skills
        </button>
        <button
          onClick={() => setActiveTab("global")}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "global"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-gray-400 hover:text-white"
          }`}
        >
          全局设置
        </button>
        <button
          onClick={() => setActiveTab("versions")}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "versions"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-gray-400 hover:text-white"
          }`}
        >
          版本历史
        </button>
      </div>

      {/* Skills 配置 */}
      {activeTab === "skills" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Skill 列表 */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-sm font-medium text-gray-400 mb-2">可用 Skills</h3>
            {config.skills.map(skill => (
              <div
                key={skill.id}
                onClick={() => setSelectedSkillId(skill.id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedSkillId === skill.id
                    ? "bg-blue-900/50 border border-blue-700"
                    : "bg-gray-800 hover:bg-gray-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{skill.metadata.name}</div>
                    <div className="text-xs text-gray-400">{skill.metadata.category}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skill.enabled}
                      onChange={(e) => toggleSkill(skill.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Skill 详情编辑 */}
          <div className="lg:col-span-2">
            {selectedSkill ? (
              <SkillEditor
                skill={selectedSkill}
                onUpdate={(updates) => handleSkillUpdate(selectedSkill.id, updates)}
              />
            ) : (
              <div className="text-center text-gray-500 py-8">
                选择一个 Skill 进行配置
              </div>
            )}
          </div>
        </div>
      )}

      {/* 全局配置 */}
      {activeTab === "global" && (
        <GlobalConfigEditor
          config={config.global}
          onUpdate={handleGlobalUpdate}
        />
      )}

      {/* 版本历史 */}
      {activeTab === "versions" && (
        <VersionHistory />
      )}
    </div>
  );
}

// ==================== Skill 编辑器 ====================

function SkillEditor({
  skill,
  onUpdate,
}: {
  skill: SkillConfig;
  onUpdate: (updates: Partial<SkillConfig>) => void;
}) {
  const [localSkill, setLocalSkill] = useState(skill);

  // 同步外部更新
  useEffect(() => {
    setLocalSkill(skill);
  }, [skill]);

  const handleChange = (path: string, value: any) => {
    const newSkill = { ...localSkill };
    const keys = path.split(".");
    let current: any = newSkill;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    setLocalSkill(newSkill);
  };

  const handleSave = () => {
    onUpdate({
      instructions: localSkill.instructions,
      parameters: localSkill.parameters,
      triggers: localSkill.triggers,
    });
  };

  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-white font-medium mb-2">{skill.metadata.name}</h3>
        <p className="text-sm text-gray-400">{skill.metadata.description}</p>
        <div className="mt-2 text-xs text-gray-500">
          最后修改: {skill.metadata.lastModified.toLocaleString()}
        </div>
      </div>

      {/* 参数配置 */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">参数配置</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">查看 Feed 时间范围 (分钟)</label>
            <input
              type="number"
              value={localSkill.parameters.lookbackMinutes}
              onChange={(e) => handleChange("parameters.lookbackMinutes", parseInt(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">置信度阈值 (0-1)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={localSkill.parameters.confidenceThreshold}
              onChange={(e) => handleChange("parameters.confidenceThreshold", parseFloat(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">最大决策时间 (秒)</label>
            <input
              type="number"
              value={localSkill.parameters.maxDecisionTime}
              onChange={(e) => handleChange("parameters.maxDecisionTime", parseInt(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
      </div>

      {/* 系统提示词 */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">系统提示词 (System Prompt)</h4>
        <textarea
          value={localSkill.instructions.system}
          onChange={(e) => handleChange("instructions.system", e.target.value)}
          rows={8}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white font-mono"
        />
      </div>

      {/* 推理流程 */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">推理流程 (Reasoning)</h4>
        <textarea
          value={localSkill.instructions.reasoning || ""}
          onChange={(e) => handleChange("instructions.reasoning", e.target.value)}
          rows={6}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white font-mono"
        />
      </div>

      {/* 约束条件 */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">约束条件</h4>
        <div className="space-y-2">
          {localSkill.instructions.constraints?.map((constraint, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={constraint}
                onChange={(e) => {
                  const newConstraints = [...(localSkill.instructions.constraints || [])];
                  newConstraints[index] = e.target.value;
                  handleChange("instructions.constraints", newConstraints);
                }}
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
              />
              <button
                onClick={() => {
                  const newConstraints = (localSkill.instructions.constraints || []).filter((_, i) => i !== index);
                  handleChange("instructions.constraints", newConstraints);
                }}
                className="px-3 py-2 text-red-400 hover:text-red-300"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const newConstraints = [...(localSkill.instructions.constraints || []), ""];
              handleChange("instructions.constraints", newConstraints);
            }}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            + 添加约束条件
          </button>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          保存更改
        </button>
      </div>
    </div>
  );
}

// ==================== 全局配置编辑器 ====================

function GlobalConfigEditor({
  config,
  onUpdate,
}: {
  config: CFOGlobalConfig;
  onUpdate: (updates: Partial<CFOGlobalConfig>) => void;
}) {
  return (
    <div className="space-y-4">
      {/* 基础信息 */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">基础信息</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">显示名称</label>
            <input
              type="text"
              value={config.base.name}
              onChange={(e) => onUpdate({ base: { ...config.base, name: e.target.value } })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">头像 Emoji</label>
            <input
              type="text"
              value={config.base.avatar}
              onChange={(e) => onUpdate({ base: { ...config.base, avatar: e.target.value } })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">性格描述</label>
            <textarea
              value={config.base.personality}
              onChange={(e) => onUpdate({ base: { ...config.base, personality: e.target.value } })}
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
      </div>

      {/* 工作模式 */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">工作模式</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">自动执行交易</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.workMode.autoExecute}
                onChange={(e) => onUpdate({ workMode: { ...config.workMode, autoExecute: e.target.checked } })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">需要用户确认</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.workMode.confirmationRequired}
                onChange={(e) => onUpdate({ workMode: { ...config.workMode, confirmationRequired: e.target.checked } })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">最低行动置信度 (0-1)</label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={config.workMode.minConfidence}
              onChange={(e) => onUpdate({ workMode: { ...config.workMode, minConfidence: parseFloat(e.target.value) } })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
      </div>

      {/* Bull/Bear 权重 */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">信息源权重</h4>
        <div className="space-y-3">
          {Object.entries(config.bullBearWeights).map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{key === 'technical' ? '技术分析' : key === 'prediction' ? '预测市场' : key === 'sentiment' ? '舆情分析' : '巨鲸监控'}</span>
                <span>{(value * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={value}
                onChange={(e) => onUpdate({
                  bullBearWeights: { ...config.bullBearWeights, [key]: parseFloat(e.target.value) }
                })}
                className="w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== 版本历史 ====================

function VersionHistory() {
  const [versions, setVersions] = useState(() => getConfigManager().getVersions());

  const handleRestore = (versionId: string) => {
    if (confirm("确定要恢复到这个版本吗？当前配置将被备份。")) {
      getConfigManager().restoreVersion(versionId);
      setVersions(getConfigManager().getVersions());
    }
  };

  return (
    <div className="space-y-2">
      {versions.length === 0 ? (
        <div className="text-center text-gray-500 py-8">暂无版本历史</div>
      ) : (
        versions.slice().reverse().map(version => (
          <div
            key={version.id}
            className={`p-3 rounded-lg ${version.isActive ? 'bg-blue-900/30 border border-blue-700' : 'bg-gray-800'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white">{version.description}</div>
                <div className="text-xs text-gray-400">
                  {version.timestamp.toLocaleString()}
                  {version.isActive && <span className="ml-2 text-blue-400">(当前)</span>}
                </div>
              </div>
              {!version.isActive && (
                <button
                  onClick={() => handleRestore(version.id)}
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                >
                  恢复
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
