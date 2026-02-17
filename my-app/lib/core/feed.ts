/**
 * TradeMind Framework - Feed System
 * 
 * Feed 总线：Agent 之间传递结构化情报的通道
 */

import type { AgentIdentity } from './types';

// ========== Feed 类型定义 ==========

export type FeedType = 'signal' | 'event' | 'alert' | 'analysis' | 'risk';
export type FeedImportance = 'low' | 'medium' | 'high' | 'critical';

export interface Feed {
  id: string;
  from: string;           // Agent ID，如 "technical", "poly", "macro"
  fromName?: string;      // 显示名称
  type: FeedType;
  importance: FeedImportance;
  timestamp: number;
  data: FeedData;
  metadata?: {
    expiresAt?: number;   // 过期时间
    relatedFeeds?: string[];  // 关联 Feed IDs
  };
}

// 具体 Feed 数据类型
export type FeedData = 
  | TechnicalSignalData
  | PolyMarketData
  | MacroRegimeData
  | RiskAlertData
  | GenericAnalysisData;

// Technical Agent 信号
export interface TechnicalSignalData {
  symbol: string;
  signalType: 'breakout' | 'reversal' | 'oversold' | 'overbought' | 'trend_confirm' | 'divergence';
  strength: number;       // 0-1 信号强度
  indicators: {
    rsi?: number;
    macd?: { value: number; signal: number; histogram: number };
    ma?: { short: number; medium: number; long: number };
    bb?: { upper: number; middle: number; lower: number; position: 'upper' | 'middle' | 'lower' };
  };
  price: {
    current: number;
    entry?: number;       // 建议入场价
    stopLoss?: number;    // 建议止损
    takeProfit?: number;  // 建议止盈
  };
  timeframe: string;      // "1h", "4h", "1d" 等
  description: string;    // 自然语言描述
}

// Polymarket 预测市场数据
export interface PolyMarketData {
  event: string;          // 事件描述
  symbol?: string;        // 相关币种
  probability: number;    // 0-1 当前概率
  probabilityDelta: number;  // 24h 变化
  volume: number;         // 交易量
  liquidity: number;      // 流动性
  description: string;    // 自然语言描述
}

// 宏观体制数据
export interface MacroRegimeData {
  regime: 'risk_on' | 'risk_off' | 'neutral' | 'uncertain';
  drivers: string[];      // 驱动因素
  narratives: string[];   // 当前主流叙事
  upcomingEvents?: Array<{
    name: string;
    time: number;
    impact: 'high' | 'medium' | 'low';
  }>;
  description: string;
}

// 风控警报
export interface RiskAlertData {
  level: 'warning' | 'critical' | 'veto';
  metric: string;         // 触发指标
  value: number;
  threshold: number;
  symbol?: string;
  action: 'reduce' | 'close' | 'hold' | 'pause';
  description: string;
}

// 通用分析
export interface GenericAnalysisData {
  title: string;
  content: string;
  tags?: string[];
}

// ========== Feed 总线 ==========

export type FeedHandler = (feed: Feed) => void | Promise<void>;

class FeedBus {
  private feeds: Feed[] = [];
  private handlers: Map<string, FeedHandler[]> = new Map();
  private globalHandlers: FeedHandler[] = [];

  // 发布 Feed
  publish(feed: Feed): void {
    // 存储
    this.feeds.unshift(feed);
    // 只保留最近 1000 条
    if (this.feeds.length > 1000) {
      this.feeds = this.feeds.slice(0, 1000);
    }

    // 触发订阅者
    const handlers = this.handlers.get(feed.from) || [];
    handlers.forEach(h => {
      try {
        h(feed);
      } catch (e) {
        console.error(`Feed handler error for ${feed.from}:`, e);
      }
    });

    // 触发全局订阅者
    this.globalHandlers.forEach(h => {
      try {
        h(feed);
      } catch (e) {
        console.error('Global feed handler error:', e);
      }
    });
  }

  // 订阅特定 Agent 的 Feed
  subscribe(agentId: string, handler: FeedHandler): () => void {
    if (!this.handlers.has(agentId)) {
      this.handlers.set(agentId, []);
    }
    this.handlers.get(agentId)!.push(handler);

    // 返回取消订阅函数
    return () => {
      const list = this.handlers.get(agentId);
      if (list) {
        const idx = list.indexOf(handler);
        if (idx > -1) list.splice(idx, 1);
      }
    };
  }

  // 订阅所有 Feed
  subscribeAll(handler: FeedHandler): () => void {
    this.globalHandlers.push(handler);
    return () => {
      const idx = this.globalHandlers.indexOf(handler);
      if (idx > -1) this.globalHandlers.splice(idx, 1);
    };
  }

  // 查询 Feed
  query(options: {
    from?: string;
    type?: FeedType;
    symbol?: string;
    since?: number;
    until?: number;
    limit?: number;
    minImportance?: FeedImportance;
  } = {}): Feed[] {
    let result = this.feeds;

    if (options.from) {
      result = result.filter(f => f.from === options.from);
    }
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
      const importanceOrder = ['low', 'medium', 'high', 'critical'];
      const minIdx = importanceOrder.indexOf(options.minImportance);
      result = result.filter(f => importanceOrder.indexOf(f.importance) >= minIdx);
    }

    // Symbol 过滤（需要在 data 中查找）
    if (options.symbol) {
      result = result.filter(f => {
        const data = f.data as any;
        return data?.symbol === options.symbol;
      });
    }

    return result.slice(0, options.limit || 50);
  }

  // 获取最新一条
  getLatest(from?: string): Feed | undefined {
    if (from) {
      return this.feeds.find(f => f.from === from);
    }
    return this.feeds[0];
  }

  // 获取特定 ID
  getById(id: string): Feed | undefined {
    return this.feeds.find(f => f.id === id);
  }

  // 清空过期 Feed
  cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    this.feeds = this.feeds.filter(f => f.timestamp > cutoff);
  }
}

// 单例导出
export const feedBus = new FeedBus();

// ========== 辅助函数 ==========

export function createFeed(
  from: string,
  type: FeedType,
  importance: FeedImportance,
  data: FeedData
): Feed {
  return {
    id: `${from}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    from,
    type,
    importance,
    timestamp: Date.now(),
    data,
  };
}

// 重要性比较
export function compareImportance(a: FeedImportance, b: FeedImportance): number {
  const order = ['low', 'medium', 'high', 'critical'];
  return order.indexOf(a) - order.indexOf(b);
}
