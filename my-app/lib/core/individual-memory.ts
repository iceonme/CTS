/**
 * TradeMind Framework - Individual Memory (Agent 成长档案)
 * 
 * 每个 Agent 的独立记忆：
 * - stats.json: 交易表现统计
 * - experiences.json: 经历记录（分析、交易、对话）
 * - insights.json: 学到的规律和洞察
 * - preferences.json: 用户偏好
 */

import type { IndividualMemory } from './types';

// 只在服务端使用 fs
let fs: typeof import('fs') | null = null;
let path: typeof import('path') | null = null;

// 动态导入 fs（只在 Node.js 环境）
async function getFs() {
  if (!fs && typeof window === 'undefined') {
    fs = await import('fs');
  }
  return fs;
}

async function getPath() {
  if (!path && typeof window === 'undefined') {
    path = await import('path');
  }
  return path;
}

// 存储目录
const DATA_DIR = typeof process !== 'undefined' ? (process.env.DATA_DIR || './data') : './data';

async function ensureDir(dir: string): Promise<void> {
  const fsModule = await getFs();
  if (fsModule && !fsModule.existsSync(dir)) {
    fsModule.mkdirSync(dir, { recursive: true });
  }
}

// ========== 统计 ==========

export interface AgentStats {
  totalAnalyses: number;
  totalTrades: number;
  accuracyRate: number;
  lastActiveAt: number;
  // 额外统计
  signalCounts?: Record<string, number>;  // 每种信号类型的发布次数
  correctPredictions?: number;
  wrongPredictions?: number;
  averageConfidence?: number;
}

// ========== 经历 ==========

export type ExperienceType = 'analysis' | 'trade' | 'prediction' | 'conversation' | 'feed_published';

export interface Experience {
  id: string;
  type: ExperienceType;
  content: string;
  result: 'success' | 'failure' | 'pending' | 'neutral';
  timestamp: number;
  metadata?: Record<string, any>;
}

// ========== 洞察 ==========

export interface Insight {
  id: string;
  pattern: string;          // 发现的模式/规律
  description: string;      // 详细描述
  confidence: number;       // 置信度
  verifiedCount: number;    // 验证次数
  successCount: number;     // 成功次数
  createdAt: number;
  lastVerifiedAt?: number;
  tags: string[];
}

// ========== 偏好 ==========

export interface UserPreferences {
  riskTolerance?: 'low' | 'medium' | 'high';
  preferredSymbols?: string[];
  preferredTimeframes?: string[];
  communicationStyle?: 'concise' | 'detailed';
  lastUpdated: number;
  [key: string]: any;
}

// ========== Individual Memory 文件存储 ==========

export class IndividualMemoryStorage implements IndividualMemory {
  private agentId: string;
  private agentDir: string;
  
  // 内存缓存
  stats: AgentStats;
  experiences: Experience[];
  insights: Insight[];
  userPreferences: UserPreferences;

  constructor(agentId: string) {
    this.agentId = agentId;
    this.agentDir = path.join(DATA_DIR, 'agents', agentId);
    ensureDir(this.agentDir);

    // 初始化
    this.stats = this.loadStats();
    this.experiences = this.loadExperiences();
    this.insights = this.loadInsights();
    this.userPreferences = this.loadPreferences();
  }

  // ========== 加载 ==========

  private loadStats(): AgentStats {
    const filePath = path.join(this.agentDir, 'stats.json');
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (e) {
      console.error(`[${this.agentId}] Failed to load stats:`, e);
    }
    return {
      totalAnalyses: 0,
      totalTrades: 0,
      accuracyRate: 0,
      lastActiveAt: Date.now(),
    };
  }

  private loadExperiences(): Experience[] {
    const filePath = path.join(this.agentDir, 'experiences.json');
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (e) {
      console.error(`[${this.agentId}] Failed to load experiences:`, e);
    }
    return [];
  }

  private loadInsights(): Insight[] {
    const filePath = path.join(this.agentDir, 'insights.json');
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (e) {
      console.error(`[${this.agentId}] Failed to load insights:`, e);
    }
    return [];
  }

  private loadPreferences(): UserPreferences {
    const filePath = path.join(this.agentDir, 'preferences.json');
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (e) {
      console.error(`[${this.agentId}] Failed to load preferences:`, e);
    }
    return { lastUpdated: Date.now() };
  }

  // ========== 保存 ==========

  private saveStats(): void {
    const filePath = path.join(this.agentDir, 'stats.json');
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.stats, null, 2));
    } catch (e) {
      console.error(`[${this.agentId}] Failed to save stats:`, e);
    }
  }

  private saveExperiences(): void {
    const filePath = path.join(this.agentDir, 'experiences.json');
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.experiences, null, 2));
    } catch (e) {
      console.error(`[${this.agentId}] Failed to save experiences:`, e);
    }
  }

  private saveInsights(): void {
    const filePath = path.join(this.agentDir, 'insights.json');
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.insights, null, 2));
    } catch (e) {
      console.error(`[${this.agentId}] Failed to save insights:`, e);
    }
  }

  private savePreferences(): void {
    this.userPreferences.lastUpdated = Date.now();
    const filePath = path.join(this.agentDir, 'preferences.json');
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.userPreferences, null, 2));
    } catch (e) {
      console.error(`[${this.agentId}] Failed to save preferences:`, e);
    }
  }

  // ========== 公共接口（兼容 IndividualMemory） ==========

  addExperience(experience: Omit<Experience, 'id' | 'timestamp'>): void {
    const fullExperience: Experience = {
      ...experience,
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    this.experiences.unshift(fullExperience);
    
    // 限制数量（保留最近 500 条）
    if (this.experiences.length > 500) {
      this.experiences = this.experiences.slice(0, 500);
    }
    
    this.saveExperiences();
    this.updateStatsFromExperience(fullExperience);
  }

  updateStats(update: Partial<AgentStats>): void {
    this.stats = { ...this.stats, ...update, lastActiveAt: Date.now() };
    this.saveStats();
  }

  getExperiences(filter?: { type?: string; limit?: number }): Experience[] {
    let result = this.experiences;
    
    if (filter?.type) {
      result = result.filter(e => e.type === filter.type);
    }
    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }
    
    return result;
  }

  // ========== 扩展接口 ==========

  addInsight(insight: Omit<Insight, 'id' | 'createdAt' | 'verifiedCount' | 'successCount'>): void {
    // 检查是否已有类似洞察
    const existing = this.insights.find(i => 
      i.pattern === insight.pattern && 
      i.tags.every(t => insight.tags.includes(t))
    );

    if (existing) {
      // 更新现有洞察
      existing.verifiedCount++;
      if (insight.confidence > 0.7) {
        existing.successCount++;
      }
      existing.lastVerifiedAt = Date.now();
      existing.confidence = (existing.confidence * existing.verifiedCount + insight.confidence) / (existing.verifiedCount + 1);
    } else {
      // 创建新洞察
      const newInsight: Insight = {
        ...insight,
        id: `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
        verifiedCount: 1,
        successCount: insight.confidence > 0.7 ? 1 : 0,
      };
      this.insights.unshift(newInsight);
    }

    // 限制数量
    if (this.insights.length > 100) {
      this.insights = this.insights.slice(0, 100);
    }

    this.saveInsights();
  }

  getInsights(filter?: { tags?: string[]; minConfidence?: number; limit?: number }): Insight[] {
    let result = this.insights;

    if (filter?.tags) {
      result = result.filter(i => filter.tags!.some(t => i.tags.includes(t)));
    }
    if (filter?.minConfidence) {
      result = result.filter(i => i.confidence >= filter.minConfidence!);
    }
    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  updatePreferences(preferences: Partial<UserPreferences>): void {
    this.userPreferences = { ...this.userPreferences, ...preferences };
    this.savePreferences();
  }

  getPreferences(): UserPreferences {
    return this.userPreferences;
  }

  // ========== 辅助方法 ==========

  private updateStatsFromExperience(exp: Experience): void {
    switch (exp.type) {
      case 'analysis':
        this.stats.totalAnalyses++;
        break;
      case 'trade':
        this.stats.totalTrades++;
        break;
      case 'prediction':
        if (exp.result === 'success') {
          this.stats.correctPredictions = (this.stats.correctPredictions || 0) + 1;
        } else if (exp.result === 'failure') {
          this.stats.wrongPredictions = (this.stats.wrongPredictions || 0) + 1;
        }
        // 重新计算准确率
        const total = (this.stats.correctPredictions || 0) + (this.stats.wrongPredictions || 0);
        if (total > 0) {
          this.stats.accuracyRate = (this.stats.correctPredictions || 0) / total;
        }
        break;
    }

    this.stats.lastActiveAt = Date.now();
    this.saveStats();
  }

  // 生成个人报告（用于 LLM 提示词）
  generateProfileSummary(): string {
    const lines = [
      `Agent: ${this.agentId}`,
      `总分析次数: ${this.stats.totalAnalyses}`,
      `总交易次数: ${this.stats.totalTrades}`,
      `预测准确率: ${(this.stats.accuracyRate * 100).toFixed(1)}%`,
      `核心洞察:`,
      ...this.insights.slice(0, 3).map(i => `  - ${i.pattern} (置信度: ${(i.confidence * 100).toFixed(0)}%)`),
    ];
    return lines.join('\n');
  }

  // 清理旧数据
  cleanup(maxAge: number = 30 * 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    const before = this.experiences.length;
    this.experiences = this.experiences.filter(e => e.timestamp > cutoff);
    if (this.experiences.length !== before) {
      this.saveExperiences();
    }
  }
}

// ========== 全局管理 ==========

const memoryStorages: Map<string, IndividualMemoryStorage> = new Map();

export function getIndividualMemoryStorage(agentId: string): IndividualMemoryStorage {
  if (!memoryStorages.has(agentId)) {
    memoryStorages.set(agentId, new IndividualMemoryStorage(agentId));
  }
  return memoryStorages.get(agentId)!;
}
