/**
 * Anthropic Skills 标准类型定义
 * 
 * Anthropic Skills 核心概念:
 * - Tools: 可执行函数，通过 MCP 暴露 (JSON Schema 定义)
 * - Skills: 封装的领域专业知识 (instructions + templates + references)
 * - Agent: BaseAgent Kernel + Standard Capabilities + Skill 定义
 */

// ==================== Tool 定义 (MCP 标准) ====================

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolParameter;
  default?: any;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
  execute: (params: any) => Promise<any>;
}

// ==================== Skill 定义 (Anthropic 标准) ====================

export interface SkillInstructions {
  system: string;        // 系统提示词 - Agent 的核心人格
  context?: string;      // 上下文说明
  reasoning?: string;    // 推理框架/流程
  constraints?: string[]; // 约束条件
}

export interface SkillExample {
  input: any;
  output: any;
  explanation?: string;
}

export interface SkillTemplate {
  [key: string]: string;
}

export interface SkillReference {
  title: string;
  content: string;
  category?: string;
}

export interface SkillTrigger {
  type: 'cron' | 'event' | 'manual';
  schedule?: string;           // cron 表达式
  event?: string;              // 事件名称
  timezone?: string;
}

export interface Skill {
  // ========== 元数据 ==========
  id: string;
  name: string;
  description: string;
  category: 'analyst' | 'strategist' | 'utility' | 'communication';
  version: string;
  
  // ========== 核心指令 (Anthropic: instructions) ==========
  instructions: SkillInstructions;
  
  // ========== 工具依赖 (Anthropic: MCP Tools) ==========
  tools: {
    required: string[];   // 必需的工具 IDs
    optional?: string[];  // 可选的工具 IDs
  };
  
  // ========== 输入/输出定义 ==========
  inputSchema?: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  outputSchema?: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  
  // ========== 参考资料 (Anthropic: references) ==========
  references?: {
    examples?: SkillExample[];
    templates?: SkillTemplate;
    docs?: SkillReference[];
  };
  
  // ========== 触发规则 ==========
  triggers?: SkillTrigger[];
  
  // ========== 执行函数 ==========
  execute: (context: SkillContext) => Promise<SkillResult>;
}

// ==================== Skill 执行上下文 ====================

export interface SkillContext {
  agent: {
    id: string;
    name: string;
    role: string;
  };
  input: any;
  memory?: any[];
  tools: Map<string, Tool>;  // Agent 可调用的工具
}

export interface SkillResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime?: number;
    toolsUsed?: string[];
    confidence?: number;
  };
}

// ==================== Agent 配置 ====================

export interface AgentSkillConfig {
  skillId: string;
  enabled: boolean;
  triggers?: SkillTrigger[];  // 可覆盖 Skill 默认触发器
  config?: Record<string, any>; // Skill 专属配置
}

export interface AgentConfig {
  id: string;
  name: string;
  role: 'cfo' | 'analyst' | 'specialist';
  avatar: string;
  personality?: string;
  expertise?: string[];
  
  // 拥有的 Skills
  skills: AgentSkillConfig[];
  
  // 标准能力
  capabilities?: {
    memory?: { enabled: boolean; scope: 'task' | 'session' | 'persistent' };
    communication?: { enabled: boolean; channels: string[] };
    ruleEngine?: { enabled: boolean; rules: string[] };
  };
}

// ==================== 事件系统 ====================

export interface SkillEvent {
  type: string;
  source: string;      // 触发源的 Agent/Skill ID
  payload: any;
  timestamp: Date;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export type SkillEventHandler = (event: SkillEvent) => void | Promise<void>;

// ==================== Feed 相关 (特殊 Skill) ====================

export interface FeedItem {
  id: string;
  type: 'analysis' | 'alert' | 'report' | 'signal';
  title: string;
  content: string;
  
  // 发布者信息
  publisher: {
    agentId: string;
    agentName: string;
    agentAvatar: string;
    skillId: string;     // 哪个 Skill 发布的
  };
  
  // 元数据
  symbol?: string;
  timestamp: Date;
  importance: 'low' | 'medium' | 'high' | 'critical';
  
  // 数据载荷
  data?: {
    confidence?: number;
    indicators?: Record<string, any>;
    [key: string]: any;
  };
}

// Feed 发布 Skill 的特殊配置
export interface FeedPublishConfig {
  feedType: 'technical' | 'sentiment' | 'prediction' | 'pa_decision' | 'cfo_decision';
  defaultImportance: FeedItem['importance'];
  templateKey: string;  // 使用哪个模板
  channels: string[];   // 发布到哪些频道
}
