/**
 * PA (Personal Assistant) 配置管理器
 * 
 * 支持通过外部界面动态配置，支持本地存储和 SaaS 化扩展
 */

import type { 
  PAConfigBundle, 
  PAGlobalConfig, 
  SkillConfig, 
  ConfigVersion,
  ConfigChangeEvent,
  ConfigStorageAdapter,
  PAIdentityTemplate 
} from './types';
import { LocalStorageAdapter, PAIdentityTemplates } from './types';

// 配置变更订阅者
type ConfigChangeHandler = (event: ConfigChangeEvent) => void;
const subscribers: ConfigChangeHandler[] = [];

/**
 * PA 配置管理器类
 */
class PAConfigManager {
  private currentConfig: PAConfigBundle | null = null;
  private versions: ConfigVersion[] = [];
  private storage: ConfigStorageAdapter;

  constructor(storage?: ConfigStorageAdapter) {
    // 默认使用本地存储，SaaS 化时可注入 API 适配器
    this.storage = storage || new LocalStorageAdapter();
    this.loadFromStorage();
  }

  // ==================== 初始化 ====================

  /**
   * 使用模板初始化配置
   */
  initializeWithTemplate(templateId: string): void {
    const template = PAIdentityTemplates.find(t => t.id === templateId);
    if (!template) {
      console.error(`[PAConfigManager] Template not found: ${templateId}`);
      return;
    }

    this.currentConfig = {
      version: '1.0.0',
      updatedAt: new Date(),
      identity: {
        ...template.defaultConfig.identity,
        name: template.defaultConfig.identity.name || '助手',
        avatar: template.defaultConfig.identity.avatar || '🤖',
        title: template.defaultConfig.identity.title || '个人助手',
        personality: template.defaultConfig.identity.personality || '专业、可靠',
        expertise: template.defaultConfig.identity.expertise || ['市场分析'],
        greeting: template.defaultConfig.identity.greeting || '您好，我是您的助手。',
      } as PAGlobalConfig['identity'],
      global: {
        identity: template.defaultConfig.identity as PAGlobalConfig['identity'],
        workMode: template.defaultConfig.workMode as PAGlobalConfig['workMode'],
        watchlist: { symbols: ['BTC', 'DOGE'], priority: { BTC: 5, DOGE: 4 } },
        notifications: { enabled: true, channels: ['feed', 'popup'], minImportance: 'medium' },
        enabledSkills: ['pa:standard:decision', 'pa:deep:analysis', 'pa:anomaly:detect'],
        sourceWeights: template.defaultConfig.sourceWeights as PAGlobalConfig['sourceWeights'],
        ui: { theme: 'dark', language: 'zh', compactMode: false },
      },
      skills: this.getDefaultSkills(),
    };

    this.saveToStorage();
    console.log(`[PAConfigManager] Initialized with template: ${template.name}`);
  }

  /**
   * 获取默认 Skills 配置
   */
  private getDefaultSkills(): SkillConfig[] {
    return [
      {
        id: 'pa:standard:decision',
        enabled: true,
        instructions: {
          system: `你是用户的个人投资助手，基于其他Agent提供的情报进行快速决策。

你的工作流程:
1. 读取最近15分钟的所有Feed
2. 综合各Agent观点
3. 使用Bull/Bear模式形成自己的判断
4. 输出交易建议`,
          reasoning: `Step 1: 信息整合 → Step 2: Bull视角 → Step 3: Bear视角 → Step 4: 综合判断 → Step 5: 输出建议`,
          constraints: ['必须在3分钟内完成', '综合置信度<60%时必须WATCH', 'Agent分歧时必须降低仓位'],
        },
        parameters: { lookbackMinutes: 15, confidenceThreshold: 0.6, maxDecisionTime: 180 },
        triggers: { cron: '*/15 * * * *' },
        tools: { required: ['feed:get_recent', 'portfolio:get_status'], optional: ['feed:publish'] },
        metadata: { name: '标准研判', description: '基于Feed信息的快速决策流程', category: 'decision', version: '1.0.0', lastModified: new Date() },
      },
      {
        id: 'pa:deep:analysis',
        enabled: true,
        instructions: {
          system: '当标准研判发现"异常"时，启动深度分析。深入验证信息，必要时调用额外工具。',
          reasoning: 'Step 1: 问题定义 → Step 2: 信息验证 → Step 3: 交叉验证 → Step 4: 形成结论',
          constraints: ['必须说明为什么进入深度分析', '允许输出"不确定，建议观望"', '必须记录分析过程供复盘'],
        },
        parameters: { lookbackMinutes: 30, confidenceThreshold: 0.5, maxDecisionTime: 900 },
        triggers: { events: ['pa:anomaly:detected'] },
        tools: { required: ['feed:get_recent'], optional: ['coingecko:get_price', 'technical:analyze'] },
        metadata: { name: '深度分析', description: '异常情况的深入分析流程', category: 'analysis', version: '1.0.0', lastModified: new Date() },
      },
      {
        id: 'pa:anomaly:detect',
        enabled: true,
        instructions: {
          system: '扫描所有Agent的Feed，识别"异常"情况。',
          constraints: ['假阳性比漏报好', '必须给出异常的严重程度'],
        },
        parameters: { lookbackMinutes: 15, confidenceThreshold: 0.2, maxDecisionTime: 30 },
        triggers: {},
        tools: { required: ['feed:get_recent', 'feed:get_history'], optional: [] },
        metadata: { name: '异常检测', description: '识别需要深度分析的情况', category: 'monitor', version: '1.0.0', lastModified: new Date() },
      },
    ];
  }

  // ==================== CRUD 操作 ====================

  /**
   * 获取当前配置
   */
  getConfig(): PAConfigBundle {
    if (!this.currentConfig) {
      // 默认使用平衡型模板
      this.initializeWithTemplate('balanced_analyst');
    }
    return this.currentConfig!;
  }

  /**
   * 获取 PA 身份信息
   */
  getIdentity(): PAGlobalConfig['identity'] {
    return this.getConfig().identity;
  }

  /**
   * 更新身份信息
   */
  updateIdentity(updates: Partial<PAGlobalConfig['identity']>): void {
    if (!this.currentConfig) return;

    this.createVersion('更新身份信息前自动备份');

    this.currentConfig.identity = { ...this.currentConfig.identity, ...updates };
    this.currentConfig.global.identity = this.currentConfig.identity;
    this.currentConfig.updatedAt = new Date();

    this.saveToStorage();
    this.notifyChange({
      type: 'identity:updated',
      changes: updates,
      timestamp: new Date(),
      source: 'ui',
    });
  }

  /**
   * 更新全局配置
   */
  updateGlobalConfig(updates: Partial<PAGlobalConfig>): void {
    if (!this.currentConfig) return;

    this.createVersion('更新全局配置前自动备份');

    this.currentConfig.global = { ...this.currentConfig.global, ...updates };
    this.currentConfig.updatedAt = new Date();

    this.saveToStorage();
    this.notifyChange({
      type: 'global:updated',
      changes: updates,
      timestamp: new Date(),
      source: 'ui',
    });
  }

  /**
   * 获取单个 Skill 配置
   */
  getSkillConfig(skillId: string): SkillConfig | undefined {
    return this.currentConfig?.skills.find(s => s.id === skillId);
  }

  /**
   * 更新 Skill 配置
   */
  updateSkillConfig(skillId: string, updates: Partial<SkillConfig>): void {
    if (!this.currentConfig) return;

    const skillIndex = this.currentConfig.skills.findIndex(s => s.id === skillId);
    if (skillIndex === -1) return;

    this.createVersion(`更新 Skill ${skillId} 前自动备份`);

    const oldSkill = this.currentConfig.skills[skillIndex];
    this.currentConfig.skills[skillIndex] = {
      ...oldSkill,
      ...updates,
      metadata: {
        ...oldSkill.metadata,
        ...updates.metadata,
        lastModified: new Date(),
      },
    };
    this.currentConfig.updatedAt = new Date();

    this.saveToStorage();
    this.notifyChange({
      type: 'skill:updated',
      skillId,
      changes: updates,
      timestamp: new Date(),
      source: 'ui',
    });
  }

  /**
   * 启用/禁用 Skill
   */
  toggleSkill(skillId: string, enabled: boolean): void {
    const skill = this.getSkillConfig(skillId);
    if (!skill) return;

    this.updateSkillConfig(skillId, { enabled });
    
    const global = this.currentConfig!.global;
    if (enabled) {
      if (!global.enabledSkills.includes(skillId)) {
        global.enabledSkills.push(skillId);
      }
    } else {
      global.enabledSkills = global.enabledSkills.filter(id => id !== skillId);
    }

    this.notifyChange({
      type: enabled ? 'skill:enabled' : 'skill:disabled',
      skillId,
      changes: { enabled },
      timestamp: new Date(),
      source: 'ui',
    });
  }

  // ==================== 版本管理 ====================

  async createVersion(description: string): Promise<string> {
    if (!this.currentConfig) return '';

    const version: ConfigVersion = {
      id: `v-${Date.now()}`,
      timestamp: new Date(),
      description,
      config: JSON.parse(JSON.stringify(this.currentConfig)),
      isActive: false,
    };

    await this.storage.saveVersion(version);
    this.versions.push(version);
    
    if (this.versions.length > 20) {
      this.versions = this.versions.slice(-20);
    }

    return version.id;
  }

  async getVersions(): Promise<ConfigVersion[]> {
    if (this.versions.length === 0) {
      this.versions = await this.storage.loadVersions();
    }
    return [...this.versions];
  }

  async restoreVersion(versionId: string): Promise<boolean> {
    const versions = await this.getVersions();
    const version = versions.find(v => v.id === versionId);
    if (!version) return false;

    await this.createVersion('恢复版本前自动备份');

    this.currentConfig = JSON.parse(JSON.stringify(version.config));
    await this.saveToStorage();
    
    this.versions.forEach(v => v.isActive = false);
    version.isActive = true;

    return true;
  }

  // ==================== 持久化 ====================

  private async loadFromStorage(): Promise<void> {
    this.currentConfig = await this.storage.load();
    if (this.currentConfig) {
      this.versions = await this.storage.loadVersions();
    }
  }

  private async saveToStorage(): Promise<void> {
    if (this.currentConfig) {
      await this.storage.save(this.currentConfig);
    }
  }

  // ==================== 事件系统 ====================

  subscribe(handler: ConfigChangeHandler): () => void {
    subscribers.push(handler);
    return () => {
      const index = subscribers.indexOf(handler);
      if (index > -1) subscribers.splice(index, 1);
    };
  }

  private notifyChange(event: ConfigChangeEvent): void {
    subscribers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('[PAConfigManager] Subscriber error:', error);
      }
    });
  }

  // ==================== 导入导出 ====================

  exportConfig(): string {
    return this.storage.export(this.getConfig());
  }

  async importConfig(json: string): Promise<boolean> {
    const config = this.storage.import(json);
    if (!config) return false;

    await this.createVersion('导入配置前自动备份');

    this.currentConfig = config;
    await this.saveToStorage();

    return true;
  }

  // ==================== SaaS 化支持 ====================

  /**
   * 切换存储适配器 (用于 SaaS 化)
   */
  setStorageAdapter(adapter: ConfigStorageAdapter): void {
    this.storage = adapter;
    // 重新加载
    this.loadFromStorage();
  }
}

// 单例导出
let paConfigManager: PAConfigManager | null = null;

export function getPAConfigManager(): PAConfigManager {
  if (!paConfigManager) {
    paConfigManager = new PAConfigManager();
  }
  return paConfigManager;
}

export { PAIdentityTemplates };
export { PAConfigManager };
export default PAConfigManager;
