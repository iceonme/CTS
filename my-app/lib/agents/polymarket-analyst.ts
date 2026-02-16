/**
 * Polymarket Analyst Agent
 * 预测市场分析专员 - 监控 Polymarket 等预测市场数据
 */

import BaseAgent from "./base";
import type { AgentTask, IntelligenceItem } from "@/lib/types";

// Polymarket 事件数据结构
interface PolymarketEvent {
  id: string;
  title: string;
  category: string;
  volume: number;
  liquidity: number;
  outcomes: {
    name: string;
    price: number; // 0-1, 代表概率
    probability: number;
  }[];
  endDate: string;
  lastTradeAt: string;
}

// 分析结果
interface PredictionAnalysis {
  eventId: string;
  eventTitle: string;
  category: string;
  topOutcome: string;
  confidence: number; // 基于交易量和价格稳定性
  volume24h: number;
  trend: "rising" | "falling" | "stable";
  significance: "low" | "medium" | "high" | "critical";
  timestamp: Date;
}

interface PolymarketTask {
  type: "fetch_events" | "analyze_event" | "crypto_related_scan";
  category?: string;
  limit?: number;
}

export class PolymarketAgent extends BaseAgent {
  private apiBaseUrl = "https://api.polymarket.com";
  private lastFetchTime: Date | null = null;
  private cachedEvents: PolymarketEvent[] = [];

  constructor() {
    super({
      name: "Polymarket专员",
      role: "prediction-analyst",
      systemPrompt: `你是 Polymarket 预测市场分析专员，专注于监控预测市场数据。

你的职责：
1. 监控 Polymarket 上与加密货币相关的事件
2. 分析市场预测概率变化，识别重要趋势
3. 评估事件对加密市场的潜在影响
4. 提供数据驱动的概率预测

重点关注的事件类型：
- ETF 批准预测
- 监管政策变化
- 重大技术升级（如比特币减半）
- 宏观经济事件对加密市场的影响

输出格式要求：
- 事件名称和当前概率
- 24小时内的概率变化
- 交易量和流动性数据
- 对加密市场的潜在影响评估`,
    });
  }

  // ==================== 核心数据获取 ====================

  /**
   * 从 Polymarket API 获取活跃事件
   * 注意：这里使用模拟数据，实际项目中需要接入真实 API
   */
  private async fetchActiveEvents(limit: number = 10): Promise<PolymarketEvent[]> {
    // TODO: 实际项目中接入 Polymarket API
    // 当前返回模拟数据用于演示
    const mockEvents: PolymarketEvent[] = [
      {
        id: "btc-etf-flow-2024",
        title: "BTC ETF 本周净流入超过 $500M？",
        category: "crypto",
        volume: 2450000,
        liquidity: 890000,
        outcomes: [
          { name: "Yes", price: 0.72, probability: 72 },
          { name: "No", price: 0.28, probability: 28 },
        ],
        endDate: "2024-12-31",
        lastTradeAt: new Date().toISOString(),
      },
      {
        id: "btc-price-100k-2024",
        title: "BTC 在 2024 年底前突破 $100,000？",
        category: "crypto",
        volume: 12800000,
        liquidity: 3200000,
        outcomes: [
          { name: "Yes", price: 0.45, probability: 45 },
          { name: "No", price: 0.55, probability: 55 },
        ],
        endDate: "2024-12-31",
        lastTradeAt: new Date().toISOString(),
      },
      {
        id: "fed-rate-cut-dec",
        title: "美联储 12 月降息？",
        category: "macro",
        volume: 5600000,
        liquidity: 1800000,
        outcomes: [
          { name: "Yes", price: 0.68, probability: 68 },
          { name: "No", price: 0.32, probability: 32 },
        ],
        endDate: "2024-12-18",
        lastTradeAt: new Date().toISOString(),
      },
      {
        id: "eth-etf-approval",
        title: "ETH 现货 ETF 2025 年 Q1 获批？",
        category: "crypto",
        volume: 4200000,
        liquidity: 1500000,
        outcomes: [
          { name: "Yes", price: 0.58, probability: 58 },
          { name: "No", price: 0.42, probability: 42 },
        ],
        endDate: "2025-03-31",
        lastTradeAt: new Date().toISOString(),
      },
    ];

    this.cachedEvents = mockEvents;
    this.lastFetchTime = new Date();
    return mockEvents;
  }

  // ==================== 分析方法 ====================

  /**
   * 分析单个事件
   */
  private analyzeEvent(event: PolymarketEvent): PredictionAnalysis {
    const topOutcome = event.outcomes.reduce((prev, current) =>
      prev.probability > current.probability ? prev : current
    );

    // 基于交易量和流动性计算置信度
    const volumeScore = Math.min(event.volume / 10000000, 1); // 最高1000万满分
    const liquidityScore = Math.min(event.liquidity / 5000000, 1); // 最高500万满分
    const confidence = Math.round((volumeScore * 0.6 + liquidityScore * 0.4) * 100) / 100;

    // 判断重要性
    let significance: "low" | "medium" | "high" | "critical" = "low";
    if (event.volume > 10000000) significance = "critical";
    else if (event.volume > 5000000) significance = "high";
    else if (event.volume > 1000000) significance = "medium";

    // 模拟趋势（实际应基于历史数据）
    const trends: ("rising" | "falling" | "stable")[] = ["rising", "falling", "stable"];
    const trend = trends[Math.floor(Math.random() * trends.length)];

    return {
      eventId: event.id,
      eventTitle: event.title,
      category: event.category,
      topOutcome: `${topOutcome.name} (${topOutcome.probability}%)`,
      confidence,
      volume24h: event.volume,
      trend,
      significance,
      timestamp: new Date(),
    };
  }

  /**
   * 扫描与加密货币相关的事件
   */
  async scanCryptoRelatedEvents(): Promise<PredictionAnalysis[]> {
    const events = await this.fetchActiveEvents(20);
    const cryptoEvents = events.filter(
      e => e.category === "crypto" || 
           e.title.toLowerCase().includes("btc") ||
           e.title.toLowerCase().includes("eth") ||
           e.title.toLowerCase().includes("bitcoin") ||
           e.title.toLowerCase().includes("etf")
    );

    return cryptoEvents.map(event => this.analyzeEvent(event));
  }

  /**
   * 生成情报项（用于 Feed 流）
   */
  async generateIntelligence(): Promise<IntelligenceItem[]> {
    const analyses = await this.scanCryptoRelatedEvents();
    
    return analyses.map(analysis => ({
      id: `polymarket-${analysis.eventId}-${Date.now()}`,
      type: "sentiment_shift", // 使用现有类型
      title: `预测市场: ${analysis.eventTitle}`,
      content: this.formatAnalysisContent(analysis),
      symbol: "BTC", // 默认为BTC，实际应根据事件智能判断
      timestamp: analysis.timestamp,
      importance: analysis.significance,
      data: {
        source: "polymarket",
        confidence: analysis.confidence,
        topOutcome: analysis.topOutcome,
        volume24h: analysis.volume24h,
        trend: analysis.trend,
      },
    }));
  }

  /**
   * 格式化分析内容
   */
  private formatAnalysisContent(analysis: PredictionAnalysis): string {
    const trendEmoji = analysis.trend === "rising" ? "📈" : analysis.trend === "falling" ? "📉" : "➡️";
    const confidenceStars = "⭐".repeat(Math.ceil(analysis.confidence * 5));
    
    return `${trendEmoji} **${analysis.topOutcome}**\n` +
           `置信度: ${confidenceStars} (${(analysis.confidence * 100).toFixed(0)}%)\n` +
           `24h 交易量: $${this.formatNumber(analysis.volume24h)}`;
  }

  /**
   * 生成摘要
   */
  generateSummary(analyses: PredictionAnalysis[]): string {
    if (analyses.length === 0) {
      return "暂无活跃的加密相关预测市场事件。";
    }

    const criticalCount = analyses.filter(a => a.significance === "critical").length;
    const highCount = analyses.filter(a => a.significance === "high").length;
    
    let summary = `🔮 **Polymarket 预测市场情报**\n\n`;
    summary += `监控到 ${analyses.length} 个加密相关事件\n`;
    summary += `🔴 高重要性: ${criticalCount} 个\n`;
    summary += `🟠 中高重要性: ${highCount} 个\n\n`;
    
    // 重要事件详情
    const topEvents = analyses
      .filter(a => a.significance === "critical" || a.significance === "high")
      .slice(0, 3);
    
    if (topEvents.length > 0) {
      summary += "**重点事件:**\n";
      topEvents.forEach(event => {
        summary += `- ${event.eventTitle}\n`;
        summary += `  → ${event.topOutcome}\n`;
      });
    }

    return summary;
  }

  // ==================== 实现抽象方法 ====================

  async executeTask<T>(task: AgentTask): Promise<T> {
    const data = task.data as PolymarketTask;

    switch (data.type) {
      case "fetch_events": {
        const events = await this.fetchActiveEvents(data.limit || 10);
        return events as T;
      }

      case "analyze_event": {
        const events = await this.fetchActiveEvents();
        const event = events.find(e => e.id === (data as unknown as { eventId: string }).eventId);
        if (!event) throw new Error("未找到事件");
        return this.analyzeEvent(event) as T;
      }

      case "crypto_related_scan": {
        const analyses = await this.scanCryptoRelatedEvents();
        return analyses as T;
      }

      default:
        throw new Error(`未知的任务类型: ${data.type}`);
    }
  }

  protected async generateResponse(
    message: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    const lowerMsg = message.toLowerCase();

    // 获取最新分析
    const analyses = await this.scanCryptoRelatedEvents();

    // 特定事件查询
    if (lowerMsg.includes("btc") || lowerMsg.includes("bitcoin")) {
      const btcEvents = analyses.filter(a => 
        a.eventTitle.toLowerCase().includes("btc") || 
        a.eventTitle.toLowerCase().includes("bitcoin")
      );
      if (btcEvents.length > 0) {
        return this.generateSummary(btcEvents);
      }
    }

    if (lowerMsg.includes("eth") || lowerMsg.includes("ethereum")) {
      const ethEvents = analyses.filter(a => 
        a.eventTitle.toLowerCase().includes("eth")
      );
      if (ethEvents.length > 0) {
        return this.generateSummary(ethEvents);
      }
    }

    // ETF 相关
    if (lowerMsg.includes("etf")) {
      const etfEvents = analyses.filter(a => 
        a.eventTitle.toLowerCase().includes("etf")
      );
      if (etfEvents.length > 0) {
        return this.generateSummary(etfEvents);
      }
    }

    // 默认返回全部摘要
    return this.generateSummary(analyses);
  }
}

// 单例模式导出
let polymarketInstance: PolymarketAgent | null = null;

export function getPolymarketAgent(): PolymarketAgent {
  if (!polymarketInstance) {
    polymarketInstance = new PolymarketAgent();
  }
  return polymarketInstance;
}

export default PolymarketAgent;
