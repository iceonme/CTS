/**
 * Skill 配置系统类型定义
 * 
 * 支持通过外部界面动态配置 CFO 的 Skills
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

// ==================== CFO 全局配置 ====================

export interface CFOGlobalConfig {
  // 基础设置
  base: {
    name: string;                // CFO 显示名称
    avatar: string;              // 头像 Emoji
    personality: string;         // 性格描述
    expertise: string[];         // 专长标签
  };
  
  // 工作模式
  workMode: {
    autoExecute: boolean;        // 是否自动执行交易 (模拟/真实)
    confirmationRequired: boolean; // 是否需要用户确认
    minConfidence: number;       // 最低置信度才行动
  };
  
  // 关注列表
  watchlist: {
    symbols: string[];           // 监控的币种
    priority: Record<string, number>; // 币种优先级 1-5
  };
  
  // 通知设置
  notifications: {
    enabled: boolean;
    channels: ('feed' | 'popup' | 'sound')[];
    minImportance: 'low' | 'medium' | 'high' | 'critical';
  };
  
  // 启用的 Skills
  enabledSkills: string[];
  
  // Bull/Bear 权重配置
  bullBearWeights: {
    technical: number;           // 技术分析权重
    prediction: number;          // 预测市场权重
    sentiment: number;           // 舆情权重
    whale: number;               // 巨鲸权重
  };
}

// ==================== 配置版本管理 ====================

export interface ConfigVersion {
  id: string;
  timestamp: Date;
  description: string;
  config: CFOConfigBundle;
  isActive: boolean;
}

export interface CFOConfigBundle {
  global: CFOGlobalConfig;
  skills: SkillConfig[];
  version: string;
  updatedAt: Date;
}

// ==================== 配置变更事件 ====================

export interface ConfigChangeEvent {
  type: 'skill:updated' | 'skill:enabled' | 'skill:disabled' | 'global:updated';
  skillId?: string;
  changes: Partial<SkillConfig> | Partial<CFOGlobalConfig>;
  timestamp: Date;
  source: 'ui' | 'api' | 'import';
}

// ==================== 预设模板 ====================

export interface SkillTemplate {
  id: string;
  name: string;
  description: string;
  category: SkillConfig['metadata']['category'];
  defaultConfig: Omit<SkillConfig, 'id' | 'metadata'>;
  preview: string;  // 预览说明
}
