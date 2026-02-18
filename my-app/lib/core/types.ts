/**
 * TradeMind Framework - Core Types
 * 
 * BaseAgent 类型定义
 */

// ========== Agent 身份定义 ==========

export interface AgentIdentity {
  id: string;
  name: string;
  role: string;           // "Personal Assistant" | "Technical Analyst" | ...
  personality: string;    // 性格描述
  background: string;     // 背景故事
  avatar?: string;
}

export interface AgentPrompts {
  system: string;         // 系统提示词
  constraints: string[];  // 约束条件
  examples?: Array<{
    input: string;
    output: string;
  }>;
}

// ========== Skill 定义 ==========

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  parameters: SkillParameter[];
  handler: SkillHandler;
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
}

export type SkillHandler = (params: any, context: SkillContext) => Promise<any>;

export interface SkillContext {
  agent: AgentIdentity;
  memory: AgentMemory;
  now?: number; // 注入当前上下文时间（如模拟回放的时间）
  callHistory: SkillCall[];
}

export interface SkillCall {
  skillId: string;
  params: any;
  result: any;
  timestamp: number;
}

// ========== 记忆系统定义 ==========

export interface SessionMemory {
  // L1: 会话级记忆 - 当前对话上下文
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'skill';
    content: string;
    timestamp: number;
  }>;
  context: Record<string, any>;  // 本轮会话的临时上下文

  addMessage(role: 'user' | 'assistant' | 'system' | 'skill', content: string): void;
  getRecent(limit: number): Array<{ role: string; content: string; timestamp: number }>;
  clear(): void;
}

export interface IndividualMemory {
  // L2: 个体级记忆 - Agent 自己的经历
  stats: {
    totalAnalyses: number;
    totalTrades: number;
    accuracyRate: number;  // 预测准确率
    lastActiveAt: number;
  };
  experiences: Array<{
    type: 'analysis' | 'trade' | 'prediction' | 'conversation' | 'feed_published';
    content: string;
    result: 'success' | 'failure' | 'pending' | 'neutral';
    timestamp: number;
    metadata?: Record<string, any>;
  }>;
  userPreferences: Record<string, any>;  // 从这个 Agent 角度观察到的用户偏好

  addExperience(experience: Omit<IndividualMemory['experiences'][0], 'timestamp'>): void;
  updateStats(update: Partial<IndividualMemory['stats']>): void;
  getExperiences(filter?: { type?: string; limit?: number }): IndividualMemory['experiences'];
}

export interface CollectiveMemory {
  // L3: 群体级记忆 - 共享的事实
  marketFacts: Array<{
    type: 'price' | 'event' | 'signal' | 'consensus';
    content: string;
    source: string[];      // 哪些 Agent 确认的
    confidence: number;    // 置信度 0-1
    timestamp: number;
    expiresAt?: number;    // 某些事实会过期
  }>;

  agentInsights: Record<string, Array<{      // 每个 Agent 的洞察
    content: string;
    timestamp: number;
  }>>;

  lessons: Array<{         // 集体学到的教训
    event: string;
    lesson: string;
    relatedAgents: string[];
    timestamp: number;
  }>;

  addFact(fact: Omit<CollectiveMemory['marketFacts'][0], 'timestamp'>): void;
  addInsight(agentId: string, insight: string): void;
  addLesson(lesson: Omit<CollectiveMemory['lessons'][0], 'timestamp'>): void;
  queryFacts(filter: { type?: string; since?: number }): CollectiveMemory['marketFacts'];
}

export interface AgentMemory {
  session: SessionMemory;
  individual: IndividualMemory;
  collective: CollectiveMemory;
}

// ========== Agent 配置定义 ==========

export type AutonomyLevel = 'high' | 'medium' | 'low';
export type AgentStatus = 'idle' | 'analyzing' | 'deciding' | 'executing' | 'error' | 'completed';

export interface AgentCapabilities {
  baseSkills: string[];           // 预制挂载的 skills（不能减少）
  extendableSkills: string[];     // 可以动态添加的 skills
  memoryAccess: {
    session: boolean;
    individual: boolean;
    collective: boolean;
  };
}

export interface AgentBehavior {
  autonomy: AutonomyLevel;        // 自主性级别
  outOfScopeStrategy: 'reject' | 'delegate_to_pa' | 'suggest_pa';
  proactiveEnabled: boolean;      // 是否支持主动任务
  canUseDynamicSkills: boolean;   // 是否能动态发现和调用其他 skills
}

export interface AgentConfig {
  identity: AgentIdentity;
  prompts: AgentPrompts;
  capabilities: AgentCapabilities;
  behavior: AgentBehavior;
  isPrimary?: boolean;            // 是否是 PA（主对象）
}

// ========== 对话定义 ==========

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    skillsCalled?: string[];
    thinking?: string;           // PA 的思考过程（Bull/Bear 推理）
  };
}

export interface ChatContext {
  sessionId?: string;
  now?: number; // 注入当前上下文时间
  history?: ChatMessage[];
}

export interface ChatResponse {
  content: string;
  thinking?: string;              // PA 的推理过程（如果开启了双视角）
  actions?: SkillCall[];
  suggestedNextSteps?: string[];
}

// ========== 工作流定义 ==========

export interface WorkflowStep {
  id: string;
  skillId: string;
  params: any | ((context: any) => any);
  condition?: (context: any) => boolean;
  onError: 'continue' | 'stop' | 'retry';
}

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  context?: Record<string, any>;
}

// ========== LLM 相关 ==========

export interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'local';
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}
