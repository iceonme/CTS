/**
 * 全局类型定义
 */

// ==================== Agent 相关 ====================

export type AgentRole = "cfo" | "tech-analyst" | "sentiment-analyst" | "risk-manager" | "prediction-analyst";

export type AgentStatus = "idle" | "analyzing" | "completed" | "error";

export interface BaseAgentConfig {
  name: string;
  role: AgentRole;
  systemPrompt: string;
}

export interface AgentMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AgentTask {
  id: string;
  type: string;
  data: unknown;
  priority: "low" | "medium" | "high";
  createdAt: Date;
}

// ==================== 市场数据 ====================

export interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume: number;
  marketCap: number;
  timestamp: Date;
}

export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface OHLCData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// ==================== 技术指标 ====================

export interface TechnicalIndicators {
  rsi: number; // 0-100
  ma7: number; // 7日移动平均线
  ma14: number; // 14日移动平均线
  ma30?: number; // 30日移动平均线
  volatility: number; // 波动率（标准差）
  trend: "up" | "down" | "sideways";
  support?: number; // 支撑位
  resistance?: number; // 阻力位
}

export interface TechnicalAnalysis {
  symbol: string;
  indicators: TechnicalIndicators;
  signals: TechnicalSignal[];
  timestamp: Date;
}

export type SignalType = "buy" | "sell" | "neutral" | "strong_buy" | "strong_sell";

export interface TechnicalSignal {
  type: SignalType;
  indicator: string;
  confidence: number; // 0-1
  description: string;
}

// ==================== CFO 推理 ====================

export type MarketSentiment = "bullish" | "bearish" | "neutral";

export interface CFOPerspective {
  mode: "bull" | "bear";
  confidence: number; // 0-1
  reasoning: string;
  keyPoints: string[];
  riskLevel: "low" | "medium" | "high";
}

export interface CFOAnalysis {
  id: string;
  symbol: string;
  timestamp: Date;
  perspectives: {
    bull: CFOPerspective;
    bear: CFOPerspective;
  };
  consensus: {
    sentiment: MarketSentiment;
    confidence: number;
    summary: string;
    action: "buy" | "sell" | "hold" | "watch";
  };
  technicalData: TechnicalAnalysis;
}

// ==================== Feed 情报 ====================

export interface IntelligenceItem {
  id: string;
  type: "price_alert" | "technical_signal" | "sentiment_shift" | "cfo_analysis" | "market_summary";
  title: string;
  content: string;
  symbol: string;
  timestamp: Date;
  importance: "low" | "medium" | "high" | "critical";
  data?: Record<string, unknown>;
}

export interface FeedFilter {
  symbols?: string[];
  types?: IntelligenceItem["type"][];
  importance?: IntelligenceItem["importance"][];
  timeRange?: "1h" | "24h" | "7d" | "30d";
}

// ==================== WarRoom 可视化 ====================

export interface WarRoomData {
  marketOverview: {
    totalMarketCap: number;
    btcDominance: number;
    fearGreedIndex: number;
    timestamp: Date;
  };
  activeAlerts: IntelligenceItem[];
  topMovers: {
    gainers: MarketData[];
    losers: MarketData[];
  };
  cfoStatus: {
    lastAnalysis: Date;
    currentSentiment: MarketSentiment;
    activeWatchlist: string[];
  };
}

// ==================== 盯盘任务 ====================

export interface WatchTask {
  id: string;
  symbol: string;
  interval: number; // 分钟
  lastRun?: Date;
  enabled: boolean;
  conditions?: WatchCondition[];
}

export interface WatchCondition {
  type: "price_above" | "price_below" | "rsi_above" | "rsi_below" | "change_above";
  value: number;
  triggered?: boolean;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  timestamp: Date;
}
