/**
 * TradeMind Framework - BaseAgent
 * 
 * 所有 Agent 的抽象基类
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
  SessionMemory,
  SkillCall,
  SkillContext,
  SkillDefinition,
  Workflow,
  WorkflowStep,
  AgentStatus,
} from './types';
import { getIndividualMemoryStorage } from './individual-memory';
import { IClock, systemClock } from './clock';

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

class CollectiveMemoryImpl implements CollectiveMemory {
  marketFacts: CollectiveMemory['marketFacts'] = [];
  agentInsights: Record<string, Array<{ content: string; timestamp: number }>> = {};
  lessons: CollectiveMemory['lessons'] = [];

  addFact(fact: Omit<CollectiveMemory['marketFacts'][0], 'timestamp'>): void {
    this.marketFacts.push({ ...fact, timestamp: Date.now() });
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
}

// ========== BaseAgent 抽象类 ==========

export abstract class BaseAgent {
  readonly config: AgentConfig;
  readonly memory: AgentMemory;
  protected status: AgentStatus = 'idle';

  protected baseSkills: Set<string>;
  private extendedSkills: Set<string>;
  private skillCallHistory: SkillCall[] = [];
  protected readonly clock: IClock;

  constructor(config: AgentConfig, clock: IClock = systemClock) {
    this.config = config;
    this.clock = clock;
    this.memory = {
      session: new SessionMemoryImpl(),
      individual: getIndividualMemoryStorage(config.identity.id),
      collective: new CollectiveMemoryImpl(),
    };
    this.baseSkills = new Set(config.capabilities.baseSkills);
    this.extendedSkills = new Set(config.capabilities.extendableSkills);
  }

  get identity(): AgentIdentity { return this.config.identity; }
  get isPrimary(): boolean { return this.config.isPrimary ?? false; }
  get autonomy(): AutonomyLevel { return this.config.behavior.autonomy; }

  getStatus(): AgentStatus { return this.status; }
  protected setStatus(status: AgentStatus): void {
    this.status = status;
    console.log(`[${this.identity.name}] 状态变更为: ${status}`);
  }

  getAvailableSkills(): string[] { return [...this.baseSkills, ...this.extendedSkills]; }
  hasSkill(skillId: string): boolean { return this.baseSkills.has(skillId) || this.extendedSkills.has(skillId); }

  abstract chat(message: string, context?: ChatContext): Promise<ChatResponse>;

  protected checkScope(message: string): { inScope: boolean; reason?: string } {
    if (this.isPrimary) return { inScope: true };
    return { inScope: true };
  }

  protected handleOutOfScope(message: string): ChatResponse {
    return { content: `超出了我的专业范围。` };
  }

  protected async executeSkill(skillId: string, params: any, context?: ChatContext): Promise<any> {
    const skill = SkillRegistry.get(skillId);
    if (!skill) throw new Error(`Skill ${skillId} not found`);

    const skillContext: SkillContext = {
      agent: this.identity,
      memory: this.memory,
      now: context?.now || this.clock.now(),
      callHistory: this.skillCallHistory,
    };

    const result = await skill.handler(params, skillContext);
    this.skillCallHistory.push({ skillId, params, result, timestamp: this.clock.now() });
    return result;
  }

  protected async executeSkills(calls: Array<{ skillId: string; params: any }>): Promise<any[]> {
    const results = [];
    for (const call of calls) {
      results.push(await this.executeSkill(call.skillId, call.params));
    }
    return results;
  }

  static registerSkill(skill: SkillDefinition): void { SkillRegistry.register(skill); }
  static getRegisteredSkills(): SkillDefinition[] { return SkillRegistry.list(); }
}

export { SkillRegistry };
