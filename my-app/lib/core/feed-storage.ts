/**
 * TradeMind Framework - Feed File Storage
 * 
 * 简单文件持久化方案：
 * 1. 每个 Agent 的 Feed 记录在单独的 JSON 文件
 * 2. 集体记忆是 Feed 的汇总和梳理
 * 3. 未来可用 LLM 将集体记忆转化为知识图谱
 */

import { feedBus, createFeed, type Feed, type FeedImportance, type FeedType } from './feed';
import type { CollectiveMemory } from './types';
import fs from 'fs';
import path from 'path';

// 存储目录
const DATA_DIR = process.env.DATA_DIR || './data';
const FEEDS_DIR = path.join(DATA_DIR, 'feeds');
const MEMORY_FILE = path.join(DATA_DIR, 'collective-memory.json');

// 确保目录存在
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ========== Agent Feed 文件存储 ==========

export class AgentFeedStorage {
  private agentId: string;
  private filePath: string;
  private feeds: Feed[] = [];
  private maxSize: number = 1000; // 最多保留 1000 条

  constructor(agentId: string) {
    this.agentId = agentId;
    ensureDir(FEEDS_DIR);
    this.filePath = path.join(FEEDS_DIR, `${agentId}.json`);
    this.load();
  }

  // 加载已有 Feed
  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.feeds = JSON.parse(data);
        console.log(`[${this.agentId}] Loaded ${this.feeds.length} feeds from file`);
      }
    } catch (e) {
      console.error(`[${this.agentId}] Failed to load feeds:`, e);
      this.feeds = [];
    }
  }

  // 保存到文件
  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.feeds, null, 2));
    } catch (e) {
      console.error(`[${this.agentId}] Failed to save feeds:`, e);
    }
  }

  // 添加新 Feed
  add(feed: Feed): void {
    this.feeds.unshift(feed);
    
    // 限制大小
    if (this.feeds.length > this.maxSize) {
      this.feeds = this.feeds.slice(0, this.maxSize);
    }
    
    this.save();
  }

  // 查询 Feed
  query(options: {
    type?: FeedType;
    since?: number;
    until?: number;
    limit?: number;
    minImportance?: FeedImportance;
  } = {}): Feed[] {
    let result = this.feeds;

    if (options.type) {
      result = result.filter(f => f.type === options.type);
    }
    if (options.since) {
      result = result.filter(f => f.timestamp >= options.since!);
    }
    if (options.until) {
      result = result.filter(f => f.timestamp <= options.until!);
    }
    if (options.minImportance) {
      const order = ['low', 'medium', 'high', 'critical'];
      const minIdx = order.indexOf(options.minImportance);
      result = result.filter(f => order.indexOf(f.importance) >= minIdx);
    }

    return result.slice(0, options.limit || 50);
  }

  // 获取最新
  getLatest(): Feed | undefined {
    return this.feeds[0];
  }

  // 获取统计
  getStats(): {
    total: number;
    byType: Record<string, number>;
    byImportance: Record<string, number>;
    timeRange: { from: number; to: number } | null;
  } {
    const byType: Record<string, number> = {};
    const byImportance: Record<string, number> = {};
    
    this.feeds.forEach(f => {
      byType[f.type] = (byType[f.type] || 0) + 1;
      byImportance[f.importance] = (byImportance[f.importance] || 0) + 1;
    });

    const timestamps = this.feeds.map(f => f.timestamp);
    const timeRange = timestamps.length > 0 
      ? { from: Math.min(...timestamps), to: Math.max(...timestamps) }
      : null;

    return {
      total: this.feeds.length,
      byType,
      byImportance,
      timeRange,
    };
  }

  // 清理旧数据
  cleanup(maxAge: number): void {
    const cutoff = Date.now() - maxAge;
    const before = this.feeds.length;
    this.feeds = this.feeds.filter(f => f.timestamp > cutoff);
    if (this.feeds.length !== before) {
      this.save();
    }
  }
}

// ========== 集体记忆文件存储 ==========

export interface CollectiveMemoryEntry {
  id: string;
  type: 'market_fact' | 'lesson' | 'consensus' | 'insight';
  content: string;
  sourceFeeds: string[];      // 来源 Feed IDs
  agentSources: string[];     // 来源 Agent IDs
  confidence: number;         // 置信度 0-1
  symbol?: string;
  tags: string[];
  createdAt: number;
  expiresAt?: number;         // 某些记忆会过期
  metadata?: Record<string, any>;
}

export class CollectiveMemoryStorage {
  private entries: CollectiveMemoryEntry[] = [];
  private filePath: string = MEMORY_FILE;

  constructor() {
    ensureDir(DATA_DIR);
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.entries = JSON.parse(data);
        console.log(`[CollectiveMemory] Loaded ${this.entries.length} entries`);
      }
    } catch (e) {
      console.error('[CollectiveMemory] Failed to load:', e);
      this.entries = [];
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2));
    } catch (e) {
      console.error('[CollectiveMemory] Failed to save:', e);
    }
  }

  // 添加记忆条目
  add(entry: Omit<CollectiveMemoryEntry, 'id' | 'createdAt'>): CollectiveMemoryEntry {
    const fullEntry: CollectiveMemoryEntry = {
      ...entry,
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
    };
    
    this.entries.unshift(fullEntry);
    this.save();
    return fullEntry;
  }

  // 从 Feed 生成集体记忆（简单的汇总逻辑）
  async summarizeFromFeeds(feeds: Feed[]): Promise<CollectiveMemoryEntry[]> {
    const newEntries: CollectiveMemoryEntry[] = [];
    
    // 按 symbol 分组
    const bySymbol = this.groupBySymbol(feeds);
    
    for (const [symbol, symbolFeeds] of Object.entries(bySymbol)) {
      // 统计信号类型
      const signalTypes = symbolFeeds
        .filter(f => f.type === 'signal')
        .map(f => (f.data as any)?.signalType)
        .filter(Boolean);
      
      // 如果有多个突破信号，生成市场事实
      if (signalTypes.filter(t => t === 'breakout').length >= 2) {
        const entry = this.add({
          type: 'market_fact',
          content: `${symbol} 近期出现多次突破信号，市场关注度高`,
          sourceFeeds: symbolFeeds.map(f => f.id),
          agentSources: [...new Set(symbolFeeds.map(f => f.from))],
          confidence: 0.75,
          symbol,
          tags: ['breakout', 'momentum', symbol],
          metadata: { signalCount: signalTypes.length },
        });
        newEntries.push(entry);
      }
      
      // 如果 Technical 和 Poly 信号冲突，生成教训
      const techSignal = symbolFeeds.find(f => f.from === 'technical');
      const polySignal = symbolFeeds.find(f => f.from === 'poly');
      
      if (techSignal && polySignal) {
        const techBullish = ['breakout', 'trend_confirm'].includes((techSignal.data as any)?.signalType);
        const polyBearish = (polySignal.data as any)?.probabilityDelta < 0;
        
        if (techBullish && polyBearish) {
          const entry = this.add({
            type: 'lesson',
            content: `${symbol} 出现技术面与预测市场背离，需警惕诱多`,
            sourceFeeds: [techSignal.id, polySignal.id],
            agentSources: ['technical', 'poly'],
            confidence: 0.8,
            symbol,
            tags: ['divergence', 'trap', symbol],
            metadata: { pattern: 'technical_bullish_vs_poly_bearish' },
          });
          newEntries.push(entry);
        }
      }
    }
    
    return newEntries;
  }

  // 查询记忆
  query(options: {
    type?: CollectiveMemoryEntry['type'];
    symbol?: string;
    tags?: string[];
    since?: number;
    minConfidence?: number;
    limit?: number;
  } = {}): CollectiveMemoryEntry[] {
    let result = this.entries;

    if (options.type) {
      result = result.filter(e => e.type === options.type);
    }
    if (options.symbol) {
      result = result.filter(e => e.symbol === options.symbol);
    }
    if (options.tags) {
      result = result.filter(e => 
        options.tags!.some(tag => e.tags.includes(tag))
      );
    }
    if (options.since) {
      result = result.filter(e => e.createdAt >= options.since!);
    }
    if (options.minConfidence) {
      result = result.filter(e => e.confidence >= options.minConfidence!);
    }

    return result.slice(0, options.limit || 50);
  }

  // 获取最新的共识
  getConsensus(symbol?: string): string | null {
    const entries = this.query({ 
      type: 'consensus', 
      symbol,
      limit: 1 
    });
    return entries[0]?.content || null;
  }

  // 获取相关记忆（用于 PA 决策）
  getRelevantForDecision(symbol: string, context: string): CollectiveMemoryEntry[] {
    // 简单实现：获取该 symbol 最近的高置信度记忆
    return this.query({
      symbol,
      minConfidence: 0.6,
      since: Date.now() - 7 * 24 * 60 * 60 * 1000, // 最近 7 天
      limit: 10,
    });
  }

  // 清理过期记忆
  cleanup(): void {
    const now = Date.now();
    const before = this.entries.length;
    this.entries = this.entries.filter(e => !e.expiresAt || e.expiresAt > now);
    if (this.entries.length !== before) {
      this.save();
    }
  }

  // 导出为知识图谱格式（未来用于 LLM/知识图谱）
  exportForKnowledgeGraph(): {
    nodes: Array<{ id: string; type: string; label: string }>;
    edges: Array<{ source: string; target: string; relation: string }>;
  } {
    const nodes: Array<{ id: string; type: string; label: string }> = [];
    const edges: Array<{ source: string; target: string; relation: string }> = [];
    
    this.entries.forEach(entry => {
      // 添加记忆节点
      nodes.push({
        id: entry.id,
        type: entry.type,
        label: entry.content.slice(0, 50),
      });
      
      // 添加与 symbol 的关系
      if (entry.symbol) {
        nodes.push({
          id: `symbol-${entry.symbol}`,
          type: 'symbol',
          label: entry.symbol,
        });
        edges.push({
          source: entry.id,
          target: `symbol-${entry.symbol}`,
          relation: 'about',
        });
      }
      
      // 添加与 source feeds 的关系
      entry.sourceFeeds.forEach(feedId => {
        edges.push({
          source: feedId,
          target: entry.id,
          relation: 'contributes_to',
        });
      });
    });
    
    return { nodes, edges };
  }

  private groupBySymbol(feeds: Feed[]): Record<string, Feed[]> {
    const groups: Record<string, Feed[]> = {};
    feeds.forEach(f => {
      const symbol = (f.data as any)?.symbol;
      if (symbol) {
        if (!groups[symbol]) groups[symbol] = [];
        groups[symbol].push(f);
      }
    });
    return groups;
  }
}

// ========== 全局实例 ==========

const agentStorages: Map<string, AgentFeedStorage> = new Map();
let collectiveMemoryStorage: CollectiveMemoryStorage | null = null;

export function getAgentFeedStorage(agentId: string): AgentFeedStorage {
  if (!agentStorages.has(agentId)) {
    agentStorages.set(agentId, new AgentFeedStorage(agentId));
  }
  return agentStorages.get(agentId)!;
}

export function getCollectiveMemoryStorage(): CollectiveMemoryStorage {
  if (!collectiveMemoryStorage) {
    collectiveMemoryStorage = new CollectiveMemoryStorage();
  }
  return collectiveMemoryStorage;
}

// ========== 集成到 FeedBus ==========

export function enableFeedPersistence(): void {
  // 监听所有 Feed，持久化到对应 Agent 的文件
  feedBus.subscribeAll((feed) => {
    // 保存到 Agent 专属文件
    const agentStorage = getAgentFeedStorage(feed.from);
    agentStorage.add(feed);
    
    // 重要 Feed 同步到集体记忆
    if (feed.importance === 'high' || feed.importance === 'critical') {
      const collective = getCollectiveMemoryStorage();
      collective.summarizeFromFeeds([feed]);
    }
  });
  
  console.log('[FeedPersistence] Enabled: feeds will be saved to files');
}

// 定期清理旧数据
export function startCleanupJob(intervalHours: number = 24): void {
  setInterval(() => {
    console.log('[FeedPersistence] Running cleanup...');
    
    // 清理每个 Agent 的旧 Feed（保留 30 天）
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    agentStorages.forEach(storage => {
      storage.cleanup(thirtyDays);
    });
    
    // 清理集体记忆中的过期条目
    const collective = getCollectiveMemoryStorage();
    collective.cleanup();
    
  }, intervalHours * 60 * 60 * 1000);
}
