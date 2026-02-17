"use client";

import { useState, useEffect } from "react";
import { getPAConfigManager, PAIdentityTemplates } from "@/lib/skills/config/manager";
import type { SkillConfig, PAGlobalConfig, ConfigChangeEvent, PAIdentityTemplate } from "@/lib/skills/config/types";

export default function PAConfigPanel() {
  const [activeTab, setActiveTab] = useState<"identity" | "skills" | "behavior" | "versions">("identity");
  const [configManager] = useState(() => getPAConfigManager());
  const [config, setConfig] = useState(configManager.getConfig());
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // 订阅配置变更
  useEffect(() => {
    const unsubscribe = configManager.subscribe((event: ConfigChangeEvent) => {
      console.log("[PAConfig] Config changed:", event);
      setConfig(configManager.getConfig());
    });
    return unsubscribe;
  }, [configManager]);

  const selectedSkill = selectedSkillId 
    ? (config.skills.find(s => s.id === selectedSkillId) ?? null)
    : null;

  const handleSkillUpdate = (skillId: string, updates: Partial<SkillConfig>) => {
    setSaveStatus("saving");
    configManager.updateSkillConfig(skillId, updates);
    setTimeout(() => setSaveStatus("saved"), 300);
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const handleGlobalUpdate = (updates: Partial<PAGlobalConfig>) => {
    setSaveStatus("saving");
    configManager.updateGlobalConfig(updates);
    setTimeout(() => setSaveStatus("saved"), 300);
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const handleIdentityUpdate = (updates: Partial<PAGlobalConfig['identity']>) => {
    setSaveStatus("saving");
    configManager.updateIdentity(updates);
    setTimeout(() => setSaveStatus("saved"), 300);
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const toggleSkill = (skillId: string, enabled: boolean) => {
    configManager.toggleSkill(skillId, enabled);
  };

  const applyTemplate = (template: PAIdentityTemplate) => {
    configManager.initializeWithTemplate(template.id);
    setShowTemplateModal(false);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.identity.avatar}</span>
          <div>
            <h2 className="text-lg font-semibold text-white">{config.identity.name} 设置</h2>
            <p className="text-xs text-gray-400">{config.identity.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "saving" && <span className="text-xs text-yellow-400">保存中...</span>}
          {saveStatus === "saved" && <span className="text-xs text-green-400">✓ 已保存</span>}
          <button
            onClick={() => setShowTemplateModal(true)}
            className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
          >
            切换模板
          </button>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-4 border-b border-gray-800">
        {[
          { id: "identity", label: "身份设定", icon: "👤" },
          { id: "skills", label: "Skills", icon: "⚡" },
          { id: "behavior", label: "行为偏好", icon: "⚙️" },
          { id: "versions", label: "版本历史", icon: "📜" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 身份设定 */}
      {activeTab === "identity" && (
        <IdentityEditor identity={config.identity} onUpdate={handleIdentityUpdate} />
      )}

      {/* Skills 配置 */}
      {activeTab === "skills" && (
        <SkillsEditor
          skills={config.skills}
          enabledSkills={config.global.enabledSkills}
          selectedSkill={selectedSkill}
          onSelectSkill={setSelectedSkillId}
          onToggleSkill={toggleSkill}
          onUpdateSkill={handleSkillUpdate}
        />
      )}

      {/* 行为偏好 */}
      {activeTab === "behavior" && (
        <BehaviorEditor config={config.global} onUpdate={handleGlobalUpdate} />
      )}

      {/* 版本历史 */}
      {activeTab === "versions" && <VersionHistory />}

      {/* 模板选择弹窗 */}
      {showTemplateModal && (
        <TemplateModal onSelect={applyTemplate} onClose={() => setShowTemplateModal(false)} />
      )}
    </div>
  );
}

// ==================== 身份编辑器 ====================

function IdentityEditor({
  identity,
  onUpdate,
}: {
  identity: PAGlobalConfig['identity'];
  onUpdate: (updates: Partial<PAGlobalConfig['identity']>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">基本资料</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">名称</label>
            <input
              type="text"
              value={identity.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">头像</label>
            <input
              type="text"
              value={identity.avatar}
              onChange={(e) => onUpdate({ avatar: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1">头衔</label>
            <input
              type="text"
              value={identity.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1">性格描述</label>
            <textarea
              value={identity.personality}
              onChange={(e) => onUpdate({ personality: e.target.value })}
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1">专长标签 (逗号分隔)</label>
            <input
              type="text"
              value={identity.expertise.join(", ")}
              onChange={(e) => onUpdate({ expertise: e.target.value.split(",").map(s => s.trim()) })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1">欢迎语</label>
            <textarea
              value={identity.greeting}
              onChange={(e) => onUpdate({ greeting: e.target.value })}
              rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
      </div>

      <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-400 mb-2">预览</h4>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{identity.avatar}</span>
          <div>
            <div className="font-medium text-white">{identity.name}</div>
            <div className="text-xs text-gray-400">{identity.title}</div>
          </div>
        </div>
        <div className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-800/50 rounded p-3">
          {identity.greeting}
        </div>
        <div className="flex flex-wrap gap-1 mt-3">
          {identity.expertise.map((exp, i) => (
            <span key={i} className="px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded text-xs">
              {exp}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== Skills 编辑器 ====================

function SkillsEditor({
  skills,
  enabledSkills,
  selectedSkill,
  onSelectSkill,
  onToggleSkill,
  onUpdateSkill,
}: {
  skills: SkillConfig[];
  enabledSkills: string[];
  selectedSkill: SkillConfig | null;
  onSelectSkill: (id: string) => void;
  onToggleSkill: (id: string, enabled: boolean) => void;
  onUpdateSkill: (id: string, updates: Partial<SkillConfig>) => void;
}) {
  const [localSkill, setLocalSkill] = useState(selectedSkill);

  useEffect(() => {
    setLocalSkill(selectedSkill);
  }, [selectedSkill]);

  const handleSave = () => {
    if (localSkill) {
      onUpdateSkill(localSkill.id, {
        instructions: localSkill.instructions,
        parameters: localSkill.parameters,
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-2">
        <h3 className="text-sm font-medium text-gray-400 mb-2">可用 Skills</h3>
        {skills.map((skill) => (
          <div
            key={skill.id}
            onClick={() => onSelectSkill(skill.id)}
            className={`p-3 rounded-lg cursor-pointer transition-colors ${
              selectedSkill?.id === skill.id
                ? "bg-blue-900/50 border border-blue-700"
                : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-white">{skill.metadata.name}</div>
                <div className="text-xs text-gray-400">{skill.metadata.category}</div>
              </div>
              <label
                onClick={(e) => e.stopPropagation()}
                className="relative inline-flex items-center cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={enabledSkills.includes(skill.id)}
                  onChange={(e) => onToggleSkill(skill.id, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="lg:col-span-2">
        {localSkill ? (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">{localSkill.metadata.name}</h3>
              <p className="text-sm text-gray-400">{localSkill.metadata.description}</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-3">参数配置</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">查看 Feed 时间范围 (分钟)</label>
                  <input
                    type="number"
                    value={localSkill.parameters.lookbackMinutes}
                    onChange={(e) => setLocalSkill({
                      ...localSkill,
                      parameters: { ...localSkill.parameters, lookbackMinutes: parseInt(e.target.value) }
                    })}
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
                    onChange={(e) => setLocalSkill({
                      ...localSkill,
                      parameters: { ...localSkill.parameters, confidenceThreshold: parseFloat(e.target.value) }
                    })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-3">系统提示词</h4>
              <textarea
                value={localSkill.instructions.system}
                onChange={(e) => setLocalSkill({
                  ...localSkill,
                  instructions: { ...localSkill.instructions, system: e.target.value }
                })}
                rows={6}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white font-mono"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                保存更改
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">选择一个 Skill 进行配置</div>
        )}
      </div>
    </div>
  );
}

// ==================== 行为偏好编辑器 ====================

function BehaviorEditor({
  config,
  onUpdate,
}: {
  config: PAGlobalConfig;
  onUpdate: (updates: Partial<PAGlobalConfig>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">工作模式</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">风险偏好</label>
            <select
              value={config.workMode.riskLevel}
              onChange={(e) => onUpdate({ workMode: { ...config.workMode, riskLevel: e.target.value as any } })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            >
              <option value="conservative">保守型 - 安全第一</option>
              <option value="moderate">平衡型 - 稳健收益</option>
              <option value="aggressive">激进型 - 追求高回报</option>
            </select>
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
            <label className="block text-xs text-gray-400 mb-1">最低行动置信度: {config.workMode.minConfidence}</label>
            <input
              type="range"
              min="0.5"
              max="0.9"
              step="0.05"
              value={config.workMode.minConfidence}
              onChange={(e) => onUpdate({ workMode: { ...config.workMode, minConfidence: parseFloat(e.target.value) } })}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">信息源权重</h4>
        <div className="space-y-3">
          {Object.entries(config.sourceWeights).map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>
                  {key === 'technical' ? '🔧 技术分析' :
                   key === 'prediction' ? '🔮 预测市场' :
                   key === 'sentiment' ? '📰 舆情分析' :
                   key === 'whale' ? '🐋 巨鲸监控' : '⛓️ 链上数据'}
                </span>
                <span>{(value * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={value}
                onChange={(e) => onUpdate({
                  sourceWeights: { ...config.sourceWeights, [key]: parseFloat(e.target.value) }
                })}
                className="w-full"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">通知设置</h4>
        <div className="flex flex-wrap gap-2">
          {['feed', 'popup', 'sound'].map((channel) => (
            <label key={channel} className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={config.notifications.channels.includes(channel as any)}
                onChange={(e) => {
                  const channels = e.target.checked
                    ? [...config.notifications.channels, channel]
                    : config.notifications.channels.filter(c => c !== channel);
                  onUpdate({ notifications: { ...config.notifications, channels: channels as any } });
                }}
                className="rounded"
              />
              <span className="text-sm text-gray-300">
                {channel === 'feed' ? 'Feed流' : channel === 'popup' ? '弹窗' : '声音'}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== 版本历史 ====================

function VersionHistory() {
  const [versions, setVersions] = useState<any[]>([]);
  const configManager = getPAConfigManager();

  useEffect(() => {
    configManager.getVersions().then(setVersions);
  }, []);

  const handleRestore = async (versionId: string) => {
    if (confirm("确定要恢复到这个版本吗？当前配置将被备份。")) {
      await configManager.restoreVersion(versionId);
      const updated = await configManager.getVersions();
      setVersions(updated);
    }
  };

  return (
    <div className="space-y-2">
      {versions.length === 0 ? (
        <div className="text-center text-gray-500 py-8">暂无版本历史</div>
      ) : (
        versions.slice().reverse().map((version: any) => (
          <div
            key={version.id}
            className={`p-3 rounded-lg ${version.isActive ? 'bg-blue-900/30 border border-blue-700' : 'bg-gray-800'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white">{version.description}</div>
                <div className="text-xs text-gray-400">
                  {new Date(version.timestamp).toLocaleString()}
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

// ==================== 模板选择弹窗 ====================

function TemplateModal({
  onSelect,
  onClose,
}: {
  onSelect: (template: PAIdentityTemplate) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">选择 PA 模板</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PAIdentityTemplates.map((template) => (
            <div
              key={template.id}
              onClick={() => onSelect(template)}
              className="p-4 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors border border-transparent hover:border-blue-600"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{template.defaultConfig.identity?.avatar}</span>
                <div>
                  <div className="font-medium text-white">{template.name}</div>
                  <div className="text-xs text-gray-400">{template.defaultConfig.identity?.title}</div>
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-2">{template.description}</p>
              <div className="text-xs text-blue-400">{template.preview}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
