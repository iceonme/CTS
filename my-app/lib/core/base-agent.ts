/**
 * TradeMind Framework - BaseAgent
 * 
 * 所有 Agent 的抽象基类
 * 
 * 核心设计：
 * 1. 每个 Agent 有预制 Skills（不能减少，可增加）
 * 2. 三层记忆：会话/个体/集体
 * 3. 自主性可配置：PA 高自主性，其他 Agent 可限制
 * 4. PA 有特殊标记 isPrimary 和独特能力
 */

import type {
  AgentConfig,
  AgentIdentity,
  AgentMemory,
  AutonomyLevel,
  ChatContext,
  ChatMessage,
  ChatResponse,
  CollectiveMemory,
  IndividualMemory,
  SessionMemory,
  SkillCall,
  SkillContext,
  SkillDefinition,
  Workflow,
  WorkflowStep,
} from './types';

// ========== 记忆系统实现 ==========

class SessionMemoryImpl implements SessionMemory {
  messages: Array<{ role: 'user' | 'assistant' | 'system' | 'skill'; content: string; timestamp: number }> = [];
  context: Record<string, any> = {};

  addMessage(role: 'user' | 'assistant' | 'system' | 'skill', content: string): void {
    this.messages.push({ role, content, timestamp: Date.now() });
  }

  getRecent(limit: number): Array<{ role: string; content: string; timestamp: number }> {
    return this.messages.slice(-limit);
  }

  clear(): void {
    this.messages = [];
    this.context = {};
  }
}

class IndividualMemoryImpl implements IndividualMemory {
  stats = {
    totalAnalyses: 0,
    totalTrades: 0,
    accuracyRate: 0,
    lastActiveAt: Date.now(),
  };
  experiences: IndividualMemory['experiences'] = [];
  userPreferences: Record<string, any> = {};

  addExperience(experience: Omit<IndividualMemory['experiences'][0], 'timestamp'>): void {
    this.experiences.push({ ...experience, timestamp: Date.now() });
    this.stats.lastActiveAt = Date.now();
  }

  updateStats(update: Partial<IndividualMemory['stats']>): void {
    this.stats = { ...this.stats, ...update, lastActiveAt: Date.now() };
  }

  getExperiences(filter?: { type?: string; limit?: number }): IndividualMemory['experiences'] {
    let result = this.experiences;
    if (filter?.type) {
      result = result.filter(e => e.type === filter.type);
    }
    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }
    return result;
  }
}

class CollectiveMemoryImpl implements CollectiveMemory {
  marketFacts: CollectiveMemory['marketFacts'] = [];
  agentInsights: Record<string, Array<{ content: string; timestamp: number }>> = {};
  lessons: CollectiveMemory['lessons'] = [];

  addFact(fact: Omit<CollectiveMemory['marketFacts'][0], 'timestamp'>): void {
    this.marketFacts.push({ ...fact, timestamp: Date.now() });
    // 清理过期事实
    const now = Date.now();
    this.marketFacts = this.marketFacts.filter(f => !f.expiresAt || f.expiresAt > now);
  }

  addInsight(agentId: string, insight: string): void {
    if (!this.agentInsights[agentId]) {
      this.agentInsights[agentId] = [];
    }
    this.agentInsights[agentId].push({ content: insight, timestamp: Date.now() });
  }

  addLesson(lesson: Omit<CollectiveMemory['lessons'][0], 'timestamp'>): void {
    this.lessons.push({ ...lesson, timestamp: Date.now() });
  }

  queryFacts(filter: { type?: string; since?: number }): CollectiveMemory['marketFacts'] {
    let result = this.marketFacts;
    if (filter.type) {
      result = result.filter(f => f.type === filter.type);
    }
    if (filter.since) {
      result = result.filter(f => f.timestamp >= filter.since);
    }
    return result.sort((a, b) => b.timestamp - a.timestamp);
  }
}

// ========== 全局 Skill 注册表 ==========

class SkillRegistry {
  private static skills = new Map<string, SkillDefinition>();

  static register(skill: SkillDefinition): void {
    this.skills.set(skill.id, skill);
  }

  static get(skillId: string): SkillDefinition | undefined {
    return this.skills.get(skillId);
  }

  static list(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  static findByPrefix(prefix: string): SkillDefinition[] {
    return this.list().filter(s => s.id.startsWith(prefix));
  }
}

// ========== BaseAgent 抽象类 ==========

export abstract class BaseAgent {
  readonly config: AgentConfig;
  readonly memory: AgentMemory;
  
  // Skill 管理
  private baseSkills: Set<string>;      // 预制技能（不能减少）
  private extendedSkills: Set<string>;  // 动态添加的技能
  private skillCallHistory: SkillCall[] = [];

  constructor(config: AgentConfig) {
    this.config = config;
    
    // 初始化记忆系统
    this.memory = {
      session: new SessionMemoryImpl(),
      individual: new IndividualMemoryImpl(),
      collective: new CollectiveMemoryImpl(),
    };

    // 初始化 Skills
    this.baseSkills = new Set(config.capabilities.baseSkills);
    this.extendedSkills = new Set(config.capabilities.extendableSkills);
  }

  // ========== 身份与配置 ==========

  get identity(): AgentIdentity {
    return this.config.identity;
  }

  get isPrimary(): boolean {
    return this.config.isPrimary ?? false;
  }

  get autonomy(): AutonomyLevel {
    return this.config.behavior.autonomy;
  }

  // ========== Skill 管理 ==========

  /**
   * 获取所有可用的 Skill IDs
   */
  getAvailableSkills(): string[] {
    return [...this.baseSkills, ...this.extendedSkills];
  }

  /**
   * 检查是否有某个 Skill
   */
  hasSkill(skillId: string): boolean {
    return this.baseSkills.has(skillId) || this.extendedSkills.has(skillId);
  }

  /**
   * 动态添加 Skill（不能减少预制 Skills）
   */
  addSkill(skillId: string): boolean {
    // 检查 Skill 是否存在于全局注册表
    const skill = SkillRegistry.get(skillId);
    if (!skill) {
      console.warn(`Skill ${skillId} not found in registry`);
      return false;
    }

    // 检查是否在允许扩展的列表中
    if (!this.config.capabilities.extendableSkills.includes(skillId)) {
      console.warn(`Skill ${skillId} not in extendable list for ${this.identity.id}`);
      return false;
    }

    this.extendedSkills.add(skillId);
    return true;
  }

  /**
   * 动态发现可用的 Skills（高自主性 Agent 可用）
   */
  discoverSkills(intent: string): SkillDefinition[] {
    if (this.autonomy === 'low') {
      return []; // 低自主性 Agent 不能动态发现
    }

    // 简单的关键词匹配，实际可以用 LLM 来做意图匹配
    const allSkills = SkillRegistry.list();
    return allSkills.filter(skill => 
      skill.description.toLowerCase().includes(intent.toLowerCase()) ||
      skill.name.toLowerCase().includes(intent.toLowerCase())
    );
  }

  // ========== 核心对话接口 ==========

  /**
   * 主对话入口 - 所有 Agent 都必须实现
   */
  abstract chat(message: string, context?: ChatContext): Promise<ChatResponse>;

  /**
   * 检查消息是否在当前 Agent 的能力范围内
   */
  protected checkScope(message: string): { inScope: boolean; reason?: string } {
    // 子类可以覆盖此方法来实现更精确的域检查
    // 默认实现：PA 总是返回 true，其他 Agent 依赖配置
    if (this.isPrimary) {
      return { inScope: true };
    }

    // 非 PA Agent：检查是否有匹配的 Skill
    const availableSkills = this.getAvailableSkills();
    if (availableSkills.length === 0) {
      return { inScope: false, reason: 'No skills available' };
    }

    // 简单启发式：检查消息是否包含 skill 相关关键词
    // 实际应该用 LLM 来判断意图
    return { inScope: true }; // 简化处理，子类可覆盖
  }

  /**
   * 处理超出范围的消息
   */
  protected handleOutOfScope(message: string): ChatResponse {
    const strategy = this.config.behavior.outOfScopeStrategy;
    
    switch (strategy) {
      case 'reject':
        return {
          content: `我是${this.identity.name}，${this.identity.role}。这超出了我的专业范围，我只能回答${this.identity.role}相关的问题。`,
          suggestedNextSteps: ['尝试询问 PA（投资助手）'],
        };
      
      case 'delegate_to_pa':
        return {
          content: `这超出了我的专业范围。让我请 PA 来帮你...`,
          suggestedNextSteps: ['正在转交给 PA...'],
        };
      
      case 'suggest_pa':
        return {
          content: `我是${this.identity.name}，${this.identity.role}。这个问题我不是很擅长，建议你问问 PA（投资助手），他有更全面的能力。`,
          suggestedNextSteps: ['询问 PA'],
        };
    }
  }

  // ========== Skill 执行 ==========

  /**
   * 执行指定的 Skill
   */
  protected async executeSkill(skillId: string, params: any): Promise<any> {
    // 检查权限
    if (!this.hasSkill(skillId)) {
      if (this.autonomy === 'high' && this.config.behavior.canUseDynamicSkills) {
        // 高自主性 Agent 可以尝试动态添加
        const added = this.addSkill(skillId);
        if (!added) {
          throw new Error(`Skill ${skillId} not available and cannot be added`);
        }
      } else {
        throw new Error(`Skill ${skillId} not available for ${this.identity.id}`);
      }
    }

    const skill = SkillRegistry.get(skillId);
    if (!skill) {
      throw new Error(`Skill ${skillId} not found in registry`);
    }

    // 执行前钩子
    await this.beforeSkillExecute(skillId, params);

    // 构建 Skill 上下文
    const skillContext: SkillContext = {
      agentId: this.identity.id,
      memory: this.memory,
      callHistory: this.skillCallHistory,
    };

    // 执行 Skill
    const result = await skill.handler(params, skillContext);

    // 记录调用历史
    const call: SkillCall = {
      skillId,
      params,
      result,
      timestamp: Date.now(),
    };
    this.skillCallHistory.push(call);

    // 更新记忆
    this.memory.session.addMessage('skill', `[Executed ${skillId}] ${JSON.stringify(result).slice(0, 200)}`);
    this.memory.individual.addExperience({
      type: 'analysis',
      content: `Executed skill: ${skillId}`,
      result: result.error ? 'failure' : 'success',
      metadata: { params, result },
    });

    // 执行后钩子
    await this.afterSkillExecute(skillId, result);

    return result;
  }

  /**
   * 执行多个 Skills（顺序执行）
   */
  protected async executeSkills(calls: Array<{ skillId: string; params: any }>): Promise<any[]> {
    const results = [];
    for (const call of calls) {
      const result = await this.executeSkill(call.skillId, call.params);
      results.push(result);
    }
    return results;
  }

  // ========== 工作流执行 ==========

  /**
   * 执行工作流
   */
  async executeWorkflow(workflow: Workflow): Promise<Record<string, any>> {
    const context: Record<string, any> = { ...workflow.context };
    
    for (const step of workflow.steps) {
      // 检查条件
      if (step.condition && !step.condition(context)) {
        continue;
      }

      try {
        // 解析参数
        const params = typeof step.params === 'function' 
          ? step.params(context) 
          : step.params;

        // 执行 Skill
        const result = await this.executeSkill(step.skillId, params);
        context[step.id] = result;

      } catch (error) {
        console.error(`Workflow step ${step.id} failed:`, error);
        
        if (step.onError === 'stop') {
          throw error;
        } else if (step.onError === 'retry') {
          // 简单的重试逻辑
          await new Promise(r => setTimeout(r, 1000));
          const result = await this.executeSkill(step.skillId, step.params);
          context[step.id] = result;
        }
        // 'continue' - 忽略错误继续
      }
    }

    return context;
  }

  // ========== 主动任务（仅高自主性 Agent） ==========

  /**
   * 启动主动任务调度（仅 PA 或高自主性 Agent）
   */
  protected startProactiveTasks(): void {
    if (!this.config.behavior.proactiveEnabled) {
      return;
    }

    // 子类实现具体的调度逻辑
    console.log(`[${this.identity.id}] Proactive tasks enabled`);
  }

  // ========== 钩子方法（子类可覆盖） ==========

  protected async beforeSkillExecute(skillId: string, params: any): Promise<void> {
    // 子类可覆盖
  }

  protected async afterSkillExecute(skillId: string, result: any): Promise<void> {
    // 子类可覆盖
  }

  // ========== 工具方法 ==========

  /**
   * 构建 System Prompt
   */
  protected buildSystemPrompt(): string {
    const { identity, prompts } = this.config;
    
    let prompt = prompts.system;
    
    // 添加身份信息
    prompt += `\n\n你的身份：${identity.name}，${identity.role}。`;
    prompt += `\n性格：${identity.personality}`;
    
    // 添加可用 Skills
    const skills = this.getAvailableSkills();
    if (skills.length > 0) {
      prompt += `\n\n你可以使用以下能力：${skills.join(', ')}`;
    }

    // 添加约束
    if (prompts.constraints.length > 0) {
      prompt += `\n\n约束：\n${prompts.constraints.map(c => `- ${c}`).join('\n')}`;
    }

    return prompt;
  }

  /**
   * 获取最近的操作历史（用于上下文）
   */
  protected getRecentHistory(limit: number = 5): SkillCall[] {
    return this.skillCallHistory.slice(-limit);
  }

  // ========== 静态方法 ==========

  static registerSkill(skill: SkillDefinition): void {
    SkillRegistry.register(skill);
  }

  static getRegisteredSkills(): SkillDefinition[] {
    return SkillRegistry.list();
  }
}

export { SkillRegistry };
