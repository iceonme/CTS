/**
 * Skill 配置系统类型定义
 * 
 * 支持通过外部界面动态配置用户的 Personal Assistant (PA)
 */

// ==================== Skill 配置 ====================

export interface SkillConfig {
  id: string;                    // Skill ID
  enabled: boolean;              // 是否启用
  
  // 可配置的 Instructions
  instructions: {
    system: string;              // 系统提示词 (可编辑)
    reasoning?: string;          // 推理流程 (可编辑)
    constraints?: string[];      // 约束条件 (可编辑)
  };
  
  // 可配置的参数
  parameters: {
    lookbackMinutes: number;     // 查看多久内的 Feed (默认15)
    confidenceThreshold: number; // 置信度阈值 (默认0.6)
    maxDecisionTime: number;     // 最大决策时间秒数 (默认180)
    [key: string]: any;          // 其他自定义参数
  };
  
  // 触发器配置
  triggers: {
    cron?: string;               // Cron 表达式
    events?: string[];           // 监听的事件
  };
  
  // 工具依赖 (可以动态调整)
  tools: {
    required: string[];
    optional: string[];
  };
  
  // 元数据
  metadata: {
    name: string;
    description: string;
    category: 'monitor' | 'analysis' | 'decision' | 'report';
    version: string;
    lastModified: Date;
    modifiedBy?: string;
  };
}

// ==================== PA (Personal Assistant) 全局配置 ====================

export interface PAGlobalConfig {
  // 基础设置 - 用户可完全自定义
  identity: {
    name: string;                // PA 显示名称 (用户自定义)
    avatar: string;              // 头像 Emoji
    title: string;               // 头衔 (如 "投资顾问"、"交易助手")
    personality: string;         // 性格描述
    expertise: string[];         // 专长标签
    greeting: string;            // 欢迎语
  };
  
  // 工作模式
  workMode: {
    autoExecute: boolean;        // 是否自动执行交易
    confirmationRequired: boolean; // 是否需要用户确认
    minConfidence: number;       // 最低置信度才行动
    riskLevel: 'conservative' | 'moderate' | 'aggressive'; // 风险偏好
  };
  
  // 关注列表
  watchlist: {
    symbols: string[];           // 监控的币种
    priority: Record<string, number>; // 币种优先级 1-5
  };
  
  // 通知设置
  notifications: {
    enabled: boolean;
    channels: ('feed' | 'popup' | 'sound' | 'email')[];
    minImportance: 'low' | 'medium' | 'high' | 'critical';
    quietHours?: {               // 免打扰时段
      start: string;             // "22:00"
      end: string;               // "08:00"
    };
  };
  
  // 启用的 Skills
  enabledSkills: string[];
  
  // 信息源权重配置 - 用户可调整各信息源的重要性
  sourceWeights: {
    technical: number;           // 技术分析权重
    prediction: number;          // 预测市场权重
    sentiment: number;           // 舆情权重
    whale: number;               // 巨鲸权重
    onChain: number;             // 链上数据权重
  };
  
  // 界面设置
  ui: {
    theme: 'dark' | 'light' | 'auto';
    language: 'zh' | 'en';
    compactMode: boolean;        // 紧凑模式
  };
}

// ==================== 配置包 ====================

export interface PAConfigBundle {
  identity: PAGlobalConfig['identity'];
  global: PAGlobalConfig;
  skills: SkillConfig[];
  version: string;
  updatedAt: Date;
  userId?: string;               // SaaS 化后使用
}

// ==================== 配置版本管理 ====================

export interface ConfigVersion {
  id: string;
  timestamp: Date;
  description: string;
  config: PAConfigBundle;
  isActive: boolean;
}

// ==================== 配置变更事件 ====================

export interface ConfigChangeEvent {
  type: 'skill:updated' | 'skill:enabled' | 'skill:disabled' | 'identity:updated' | 'global:updated';
  skillId?: string;
  changes: any;
  timestamp: Date;
  source: 'ui' | 'api' | 'import' | 'sync';
}

// ==================== 预设模板 ====================

export interface PAIdentityTemplate {
  id: string;
  name: string;
  description: string;
  preview: string;
  defaultConfig: {
    identity: Partial<PAGlobalConfig['identity']>;
    workMode: Partial<PAGlobalConfig['workMode']>;
    sourceWeights: Partial<PAGlobalConfig['sourceWeights']>;
  };
}

// 预设身份模板
export const PAIdentityTemplates: PAIdentityTemplate[] = [
  {
    id: 'conservative_advisor',
    name: '稳健型投资顾问',
    description: '风险厌恶型，注重本金安全，追求稳健收益',
    preview: '👔 稳健型顾问 - "宁可错过，不可做错"',
    defaultConfig: {
      identity: {
        name: '投资顾问',
        avatar: '👔',
        title: '稳健型投资顾问',
        personality: '稳重、谨慎、风险控制优先',
        expertise: ['风险管理', '长期趋势', '资产配置'],
        greeting: '您好，我是您的投资顾问。我会帮您稳健地管理资产。',
      },
      workMode: {
        riskLevel: 'conservative',
        minConfidence: 0.75,
        autoExecute: false,
        confirmationRequired: true,
      },
      sourceWeights: {
        technical: 0.3,
        prediction: 0.2,
        sentiment: 0.2,
        whale: 0.15,
        onChain: 0.15,
      },
    },
  },
  {
    id: 'aggressive_trader',
    name: '激进型交易助手',
    description: '追求高收益，敢于承担风险，快进快出',
    preview: '🚀 激进交易助手 - "抓住机会，果断出击"',
    defaultConfig: {
      identity: {
        name: '交易助手',
        avatar: '🚀',
        title: '激进型交易助手',
        personality: '果断、敏锐、追求效率',
        expertise: ['短线交易', '机会捕捉', '技术分析'],
        greeting: 'yo！我是你的交易助手，让我们一起抓住每一个机会！',
      },
      workMode: {
        riskLevel: 'aggressive',
        minConfidence: 0.55,
        autoExecute: false,
        confirmationRequired: true,
      },
      sourceWeights: {
        technical: 0.5,
        prediction: 0.1,
        sentiment: 0.2,
        whale: 0.1,
        onChain: 0.1,
      },
    },
  },
  {
    id: 'balanced_analyst',
    name: '平衡型分析师',
    description: '综合考虑风险和收益，平衡决策',
    preview: '⚖️ 平衡分析师 - "理性分析，平衡决策"',
    defaultConfig: {
      identity: {
        name: '分析师',
        avatar: '⚖️',
        title: '平衡型分析师',
        personality: '理性、客观、数据驱动',
        expertise: ['市场分析', '风险评估', '机会发现'],
        greeting: '您好，我是您的分析师。我会为您提供客观的市场分析和建议。',
      },
      workMode: {
        riskLevel: 'moderate',
        minConfidence: 0.65,
        autoExecute: false,
        confirmationRequired: true,
      },
      sourceWeights: {
        technical: 0.35,
        prediction: 0.25,
        sentiment: 0.2,
        whale: 0.1,
        onChain: 0.1,
      },
    },
  },
  {
    id: 'custom',
    name: '完全自定义',
    description: '从零开始，完全自定义您的 PA',
    preview: '🤖 自定义 - "打造专属于你的助手"',
    defaultConfig: {
      identity: {
        name: '助手',
        avatar: '🤖',
        title: '个人助手',
        personality: '专业、高效、可靠',
        expertise: ['市场监控', '交易辅助'],
        greeting: '您好，我是您的个人助手。',
      },
      workMode: {
        riskLevel: 'moderate',
        minConfidence: 0.7,
        autoExecute: false,
        confirmationRequired: true,
      },
      sourceWeights: {
        technical: 0.4,
        prediction: 0.3,
        sentiment: 0.1,
        whale: 0.1,
        onChain: 0.1,
      },
    },
  },
];

// ==================== 存储适配器接口 (SaaS 化准备) ====================

export interface ConfigStorageAdapter {
  // 读取配置
  load(userId?: string): Promise<PAConfigBundle | null>;
  
  // 保存配置
  save(config: PAConfigBundle, userId?: string): Promise<void>;
  
  // 读取版本历史
  loadVersions(userId?: string): Promise<ConfigVersion[]>;
  
  // 保存版本
  saveVersion(version: ConfigVersion, userId?: string): Promise<void>;
  
  // 导出配置
  export(config: PAConfigBundle): string;
  
  // 导入配置
  import(data: string): PAConfigBundle | null;
}

// 本地存储适配器 (当前实现)
export class LocalStorageAdapter implements ConfigStorageAdapter {
  private readonly CONFIG_KEY = 'cts_pa_config';
  private readonly VERSIONS_KEY = 'cts_pa_config_versions';
  
  async load(): Promise<PAConfigBundle | null> {
    if (typeof window === 'undefined') return null;
    const json = localStorage.getItem(this.CONFIG_KEY);
    if (!json) return null;
    try {
      return JSON.parse(json, (key, value) => {
        if (['updatedAt', 'lastModified', 'timestamp'].includes(key)) {
          return new Date(value);
        }
        return value;
      });
    } catch {
      return null;
    }
  }
  
  async save(config: PAConfigBundle): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
  }
  
  async loadVersions(): Promise<ConfigVersion[]> {
    if (typeof window === 'undefined') return [];
    const json = localStorage.getItem(this.VERSIONS_KEY);
    if (!json) return [];
    try {
      return JSON.parse(json, (key, value) => {
        if (['timestamp', 'updatedAt', 'lastModified'].includes(key)) {
          return new Date(value);
        }
        return value;
      });
    } catch {
      return [];
    }
  }
  
  async saveVersion(version: ConfigVersion): Promise<void> {
    const versions = await this.loadVersions();
    versions.push(version);
    if (versions.length > 20) versions.shift();
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.VERSIONS_KEY, JSON.stringify(versions));
    }
  }
  
  export(config: PAConfigBundle): string {
    return JSON.stringify(config, null, 2);
  }
  
  import(data: string): PAConfigBundle | null {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}

// 未来 SaaS 化时的后端 API 适配器
export class ApiStorageAdapter implements ConfigStorageAdapter {
  private apiBaseUrl: string;
  private authToken: string;
  
  constructor(apiBaseUrl: string, authToken: string) {
    this.apiBaseUrl = apiBaseUrl;
    this.authToken = authToken;
  }
  
  async load(userId?: string): Promise<PAConfigBundle | null> {
    const response = await fetch(`${this.apiBaseUrl}/config/${userId}`, {
      headers: { Authorization: `Bearer ${this.authToken}` },
    });
    if (!response.ok) return null;
    return response.json();
  }
  
  async save(config: PAConfigBundle, userId?: string): Promise<void> {
    await fetch(`${this.apiBaseUrl}/config/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.authToken}`,
      },
      body: JSON.stringify(config),
    });
  }
  
  async loadVersions(userId?: string): Promise<ConfigVersion[]> {
    const response = await fetch(`${this.apiBaseUrl}/config/${userId}/versions`, {
      headers: { Authorization: `Bearer ${this.authToken}` },
    });
    if (!response.ok) return [];
    return response.json();
  }
  
  async saveVersion(version: ConfigVersion, userId?: string): Promise<void> {
    await fetch(`${this.apiBaseUrl}/config/${userId}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.authToken}`,
      },
      body: JSON.stringify(version),
    });
  }
  
  export(config: PAConfigBundle): string {
    return JSON.stringify(config, null, 2);
  }
  
  import(data: string): PAConfigBundle | null {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}
