/**
 * Skill 配置管理器
 * 
 * 负责配置的 CRUD、持久化、版本管理和热更新
 */

import type { 
  CFOConfigBundle, 
  CFOGlobalConfig, 
  SkillConfig, 
  ConfigVersion,
  ConfigChangeEvent 
} from './types';

// 配置存储键
const CONFIG_STORAGE_KEY = 'cts_cfo_config';
const CONFIG_VERSIONS_KEY = 'cts_cfo_config_versions';

// 配置变更订阅者
type ConfigChangeHandler = (event: ConfigChangeEvent) => void;
const subscribers: ConfigChangeHandler[] = [];

/**
 * 配置管理器类
 */
class ConfigManager {
  private currentConfig: CFOConfigBundle | null = null;
  private versions: ConfigVersion[] = [];

  constructor() {
    this.loadFromStorage();
  }

  // ==================== 初始化 ====================

  /**
   * 加载默认配置
   */
  private getDefaultConfig(): CFOConfigBundle {
    return {
      version: '1.0.0',
      updatedAt: new Date(),
      global: {
        base: {
          name: 'CFO',
          avatar: '👔',
          personality: '稳重、数据驱动、风险控制优先',
          expertise: ['资金管理', '风险控制', '趋势判断'],
        },
        workMode: {
          autoExecute: false,
          confirmationRequired: true,
          minConfidence: 0.7,
        },
        watchlist: {
          symbols: ['BTC', 'DOGE'],
          priority: { BTC: 5, DOGE: 4 },
        },
        notifications: {
          enabled: true,
          channels: ['feed', 'popup'],
          minImportance: 'medium',
        },
        enabledSkills: ['cfo:standard:decision', 'cfo:deep:analysis', 'cfo:anomaly:detect'],
        bullBearWeights: {
          technical: 0.4,
          prediction: 0.3,
          sentiment: 0.2,
          whale: 0.1,
        },
      },
      skills: [
        // 标准研判 Skill 默认配置
        {
          id: 'cfo:standard:decision',
          enabled: true,
          instructions: {
            system: `你是CFO，基于其他Agent提供的情报进行快速决策。

你的工作流程:
1. 读取最近15分钟的所有Feed
2. 综合各Agent观点
3. 使用Bull/Bear模式形成自己的判断
4. 输出交易建议

重要原则:
- 信任但不盲从: 参考各Agent置信度，但最终决策由你负责
- 冲突处理: 当Agent观点冲突时，标记为"分歧"，降低交易仓位
- 简单直接: 标准流程不求完美，但求快速`,
            reasoning: `标准研判流程 (3分钟内完成):

Step 1: 信息整合 (30s)
  收集各Agent Feed
  
Step 2: Bull视角 (45s)
  "假设我是多头，这些信号意味着什么？"
  
Step 3: Bear视角 (45s)
  "假设我是空头，风险点在哪里？"
  
Step 4: 综合判断 (60s)
  对比Bull/Bear置信度
  
Step 5: 输出建议 (60s)
  action + confidence + reasoning`,
            constraints: [
              '必须在3分钟内完成',
              '综合置信度<60%时必须WATCH',
              'Agent分歧时必须降低仓位(建议5%而非15%)',
              '必须说明参考了哪些Agent的Feed',
            ],
          },
          parameters: {
            lookbackMinutes: 15,
            confidenceThreshold: 0.6,
            maxDecisionTime: 180,
          },
          triggers: {
            cron: '*/15 * * * *',
          },
          tools: {
            required: ['feed:get_recent', 'portfolio:get_status'],
            optional: ['feed:publish'],
          },
          metadata: {
            name: '标准研判',
            description: '基于Feed信息的快速决策流程',
            category: 'decision',
            version: '1.0.0',
            lastModified: new Date(),
          },
        },
        // 深度分析 Skill 默认配置
        {
          id: 'cfo:deep:analysis',
          enabled: true,
          instructions: {
            system: `当标准研判发现"异常"时，启动深度分析。

异常情况包括:
1. Agent信号冲突
2. 置信度突变
3. 新信息出现
4. 市场异动

深度分析原则:
- 不轻信单一信息源
- 主动验证关键数据
- 必要时调用额外工具
- 可以"暂时不决策"，选择观望`,
            reasoning: `深度分析流程 (10-15分钟):

Step 1: 问题定义 (2min)
  明确异常点是什么?

Step 2: 信息验证 (5min)
  调用工具验证关键数据

Step 3: 交叉验证 (3min)
  对比多个数据源

Step 4: 形成结论 (2min)
  基于验证后的信息重新研判`,
            constraints: [
              '必须说明为什么进入深度分析',
              '必须列出验证了哪些数据',
              '允许输出"不确定，建议观望"',
              '必须记录分析过程供复盘',
            ],
          },
          parameters: {
            lookbackMinutes: 30,
            confidenceThreshold: 0.5,
            maxDecisionTime: 900,
          },
          triggers: {
            events: ['cfo:anomaly:detected'],
          },
          tools: {
            required: ['feed:get_recent'],
            optional: ['coingecko:get_price', 'coingecko:get_chart', 'technical:analyze'],
          },
          metadata: {
            name: '深度分析',
            description: '异常情况的深入分析流程',
            category: 'analysis',
            version: '1.0.0',
            lastModified: new Date(),
          },
        },
      ],
    };
  }

  // ==================== CRUD 操作 ====================

  /**
   * 获取当前配置
   */
  getConfig(): CFOConfigBundle {
    if (!this.currentConfig) {
      this.currentConfig = this.getDefaultConfig();
      this.saveToStorage();
    }
    return this.currentConfig;
  }

  /**
   * 更新全局配置
   */
  updateGlobalConfig(updates: Partial<CFOGlobalConfig>): void {
    if (!this.currentConfig) return;

    // 创建新版本备份
    this.createVersion('更新全局配置前自动备份');

    // 应用更新
    this.currentConfig.global = {
      ...this.currentConfig.global,
      ...updates,
    };
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

    // 创建新版本备份
    this.createVersion(`更新 Skill ${skillId} 前自动备份`);

    // 应用更新
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
    
    // 同时更新全局配置中的 enabledSkills
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

  /**
   * 创建配置版本
   */
  createVersion(description: string): string {
    if (!this.currentConfig) return '';

    const version: ConfigVersion = {
      id: `v-${Date.now()}`,
      timestamp: new Date(),
      description,
      config: JSON.parse(JSON.stringify(this.currentConfig)),
      isActive: false,
    };

    this.versions.push(version);
    
    // 只保留最近20个版本
    if (this.versions.length > 20) {
      this.versions = this.versions.slice(-20);
    }

    this.saveVersionsToStorage();
    return version.id;
  }

  /**
   * 获取所有版本
   */
  getVersions(): ConfigVersion[] {
    return [...this.versions];
  }

  /**
   * 恢复到指定版本
   */
  restoreVersion(versionId: string): boolean {
    const version = this.versions.find(v => v.id === versionId);
    if (!version) return false;

    this.currentConfig = JSON.parse(JSON.stringify(version.config));
    this.saveToStorage();
    
    // 标记为激活版本
    this.versions.forEach(v => v.isActive = false);
    version.isActive = true;
    this.saveVersionsToStorage();

    return true;
  }

  // ==================== 持久化 ====================

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const configJson = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (configJson) {
        this.currentConfig = JSON.parse(configJson, (key, value) => {
          // 恢复 Date 对象
          if (key === 'updatedAt' || key === 'lastModified' || key === 'timestamp') {
            return new Date(value);
          }
          return value;
        });
      }

      const versionsJson = localStorage.getItem(CONFIG_VERSIONS_KEY);
      if (versionsJson) {
        this.versions = JSON.parse(versionsJson, (key, value) => {
          if (key === 'timestamp' || key === 'updatedAt' || key === 'lastModified') {
            return new Date(value);
          }
          return value;
        });
      }
    } catch (error) {
      console.error('[ConfigManager] Failed to load from storage:', error);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined' || !this.currentConfig) return;

    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.currentConfig));
    } catch (error) {
      console.error('[ConfigManager] Failed to save to storage:', error);
    }
  }

  private saveVersionsToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(CONFIG_VERSIONS_KEY, JSON.stringify(this.versions));
    } catch (error) {
      console.error('[ConfigManager] Failed to save versions:', error);
    }
  }

  // ==================== 事件系统 ====================

  /**
   * 订阅配置变更
   */
  subscribe(handler: ConfigChangeHandler): () => void {
    subscribers.push(handler);
    return () => {
      const index = subscribers.indexOf(handler);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
    };
  }

  private notifyChange(event: ConfigChangeEvent): void {
    subscribers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('[ConfigManager] Subscriber error:', error);
      }
    });
  }

  // ==================== 导入导出 ====================

  /**
   * 导出配置为 JSON
   */
  exportConfig(): string {
    return JSON.stringify(this.currentConfig, null, 2);
  }

  /**
   * 导入配置
   */
  importConfig(json: string): boolean {
    try {
      const config = JSON.parse(json);
      
      // 基础验证
      if (!config.global || !config.skills) {
        return false;
      }

      // 创建备份
      this.createVersion('导入配置前自动备份');

      // 应用新配置
      this.currentConfig = config;
      this.saveToStorage();

      return true;
    } catch (error) {
      console.error('[ConfigManager] Import failed:', error);
      return false;
    }
  }
}

// 单例导出
let configManager: ConfigManager | null = null;

export function getConfigManager(): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager();
  }
  return configManager;
}

export default ConfigManager;
