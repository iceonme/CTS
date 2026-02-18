/**
 * CFO Agent
 * 首席财务官 - 负责市场分析决策和整体策略
 */

import { BaseAgent } from "@/lib/core/base-agent";
import { getTechnicalAnalyst, type TechnicalAnalyst } from "./tech-analyst";
import { analyzeWithCFO, analyzeMultipleWithCFO } from "@/lib/cfo/reasoning";
import { getFeedItems } from "@/lib/feed/publisher";
import { getPortfolioManager } from "@/lib/trading/portfolio";
import type { AgentTask, MarketSentiment, CFOPerspective, CFOAnalysis, TechnicalAnalysis, IntelligenceItem } from "@/lib/types";

interface CFOTask {
  type: "single_analysis" | "market_overview" | "portfolio_review";
  symbols?: string[];
  symbol?: string;
  portfolio?: { symbol: string; allocation: number }[];
}

interface CFOInsight {
  type: "market_outlook" | "risk_assessment" | "opportunity" | "warning";
  title: string;
  content: string;
  confidence: number;
  relatedSymbols: string[];
  timestamp: Date;
}

export class CFOAgent extends BaseAgent {
  private techAnalyst: TechnicalAnalyst;
  private recentAnalyses: Map<string, CFOAnalysis> = new Map();
  private maxCacheSize = 20;

  constructor() {
    super({
      name: "CFO",
      role: "cfo",
      systemPrompt: `你是 CryptoPulse AI 的首席财务官 (CFO)。

你的职责：
1. 监督所有市场分析并做出战略决策
2. 使用双模式推理评估看涨和看跌观点
3. 提供明确的买入/卖出/持有建议及置信度
4. 评估投资组合风险和市场机会
5. 以专业、简洁的方式沟通

始终在给出最终判断前呈现双方观点（Bull vs Bear）。
以数据驱动和量化的方式进行分析和输出。`,
    });

    this.techAnalyst = getTechnicalAnalyst();
  }

  // ==================== 核心分析方法 ====================

  /**
   * 分析单个币种
   */
  async analyzeSymbol(symbol: string): Promise<CFOAnalysis> {
    const task = {
      id: `cfo-task-${Date.now()}`,
      type: "analyze_symbol",
      data: { symbol },
      priority: "high" as const,
      createdAt: new Date(),
    };

    const result = await this.techAnalyst.processTask(task);

    if (!result.success || !result.data) {
      throw new Error(result.error || "技术分析失败");
    }

    const cfoAnalysis = analyzeWithCFO(result.data as TechnicalAnalysis);
    this.cacheAnalysis(cfoAnalysis);

    return cfoAnalysis;
  }

  /**
   * 分析多个币种
   */
  async analyzeMultiple(symbols: string[]): Promise<CFOAnalysis[]> {
    const analyses: CFOAnalysis[] = [];

    for (const symbol of symbols) {
      try {
        const analysis = await this.analyzeSymbol(symbol);
        analyses.push(analysis);
      } catch (error) {
        console.error(`[CFO] 分析 ${symbol} 失败:`, error);
        // 返回一个带有错误状态的 mock 分析，而不是让整个流程失败
        analyses.push(this.createErrorAnalysis(symbol, error instanceof Error ? error.message : '未知错误'));
      }
      // 增加延迟避免 429 限速（CoinGecko 免费版：50 req/min = 1.2s/req）
      await this.delay(1300);
    }

    return analyses;
  }

  /**
   * 创建错误分析占位符
   */
  private createErrorAnalysis(symbol: string, errorMessage: string): CFOAnalysis {
    const now = new Date();
    return {
      id: `cfo-error-${Date.now()}-${symbol}`,
      symbol,
      timestamp: now,
      perspectives: {
        bull: {
          mode: "bull",
          confidence: 0,
          reasoning: "数据暂时不可用",
          keyPoints: ["无法获取市场数据，请稍后重试"],
          riskLevel: "medium",
        },
        bear: {
          mode: "bear",
          confidence: 0,
          reasoning: "数据暂时不可用",
          keyPoints: [errorMessage.includes('429') ? 'API 限速，请稍后再试' : '网络连接问题'],
          riskLevel: "medium",
        },
      },
      consensus: {
        sentiment: "neutral",
        confidence: 0,
        summary: errorMessage.includes('429') ? "API 请求过于频繁，请稍后重试" : "数据加载失败，请刷新页面重试",
        action: "watch",
      },
      technicalData: {
        symbol,
        indicators: {
          rsi: 50,
          ma7: 0,
          ma14: 0,
          volatility: 0,
          trend: "sideways",
        },
        signals: [],
        timestamp: now,
      },
    };
  }

  /**
   * 获取市场概览
   */
  async getMarketOverview(): Promise<{
    analyses: CFOAnalysis[];
    overallSentiment: MarketSentiment;
    topOpportunities: string[];
    topRisks: string[];
    summary: string;
  }> {
    // 分析主要币种
    const symbols = ["BTC", "ETH", "DOGE", "SOL"];
    const analyses = await this.analyzeMultiple(symbols);

    // 计算整体情绪
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;
    let errorCount = 0;

    const opportunities: string[] = [];
    const risks: string[] = [];

    for (const analysis of analyses) {
      // 跳过错误分析
      if (analysis.consensus.confidence === 0 && analysis.perspectives.bull.confidence === 0) {
        errorCount++;
        continue;
      }

      switch (analysis.consensus.sentiment) {
        case "bullish":
          bullishCount++;
          if (analysis.consensus.confidence > 0.6) {
            opportunities.push(analysis.symbol);
          }
          break;
        case "bearish":
          bearishCount++;
          if (analysis.consensus.confidence > 0.6) {
            risks.push(analysis.symbol);
          }
          break;
        case "neutral":
          neutralCount++;
          break;
      }
    }

    const validAnalyses = analyses.length - errorCount;

    let overallSentiment: MarketSentiment;
    let summary: string;

    if (validAnalyses === 0) {
      overallSentiment = "neutral";
      summary = "数据加载失败，请稍后刷新页面重试。";
    } else if (bullishCount > bearishCount && bullishCount > neutralCount) {
      overallSentiment = "bullish";
      summary = `市场呈现看涨势头，${bullishCount}/${validAnalyses} 个资产呈积极态势。`;
    } else if (bearishCount > bullishCount && bearishCount > neutralCount) {
      overallSentiment = "bearish";
      summary = `市场承压，${bearishCount}/${validAnalyses} 个资产呈消极态势。`;
    } else {
      overallSentiment = "neutral";
      summary = `市场信号混杂，${neutralCount}/${validAnalyses} 个资产呈中性态势。`;
    }

    return {
      analyses,
      overallSentiment,
      topOpportunities: opportunities.slice(0, 3),
      topRisks: risks.slice(0, 3),
      summary,
    };
  }

  // ==================== 生成洞察 ====================

  /**
   * 生成 CFO 洞察
   */
  generateInsights(analyses: CFOAnalysis[]): CFOInsight[] {
    const insights: CFOInsight[] = [];

    for (const analysis of analyses) {
      const { symbol, consensus, perspectives } = analysis;

      // 强信号洞察
      if (consensus.confidence > 0.7) {
        insights.push({
          type: consensus.sentiment === "bullish" ? "opportunity" : "warning",
          title: `${symbol} ${consensus.sentiment === "bullish" ? "Opportunity" : "Risk Alert"}`,
          content: consensus.summary,
          confidence: consensus.confidence,
          relatedSymbols: [symbol],
          timestamp: new Date(),
        });
      }

      // 观点分歧洞察
      const bullConf = perspectives.bull.confidence;
      const bearConf = perspectives.bear.confidence;
      if (Math.abs(bullConf - bearConf) < 0.2 && bullConf > 0.4 && bearConf > 0.4) {
        insights.push({
          type: "market_outlook",
          title: `${symbol} at Critical Juncture`,
          content: `Bull case (${(bullConf * 100).toFixed(0)}% confidence) vs Bear case (${(bearConf * 100).toFixed(0)}% confidence). Market direction unclear.`,
          confidence: 0.5,
          relatedSymbols: [symbol],
          timestamp: new Date(),
        });
      }
    }

    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  // ==================== 基于 Feed 的智能判断 ====================

  /**
   * 基于 Feed 情报做交易决策
   * 综合分析所有 Agent 发布的情报，给出交易建议
   */
  async analyzeFromFeed(symbols?: string[]): Promise<{
    symbol: string;
    action: "buy" | "sell" | "hold" | "watch";
    confidence: number;
    reasoning: string;
    position: {
      size: "small" | "medium" | "large";
      percentage: number; // 建议仓位百分比
    };
    stopLoss?: number;
    takeProfit?: number;
    timeframe: string;
  }[]> {
    const targetSymbols = symbols || ["BTC", "DOGE"];
    const recommendations: Awaited<ReturnType<typeof this.analyzeFromFeed>> = [];

    // 获取最近的情报（30分钟内）
    const recentFeeds = getFeedItems({ limit: 50 });
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    const relevantFeeds = recentFeeds.filter(
      f => f.timestamp.getTime() > thirtyMinutesAgo
    );

    for (const symbol of targetSymbols) {
      // 筛选该币种相关的情报
      const symbolFeeds = relevantFeeds.filter(f => 
        f.symbol === symbol || f.title.includes(symbol)
      );

      // 分类统计
      const techSignals = symbolFeeds.filter(f => f.type === "technical_signal");
      const paAnalyses = symbolFeeds.filter(f => f.type === "pa_analysis");
      const sentimentFeeds = symbolFeeds.filter(f => f.type === "sentiment_shift");

      // 计算综合得分
      let bullishScore = 0;
      let bearishScore = 0;
      let totalWeight = 0;

      // 技术分析权重 40%
      techSignals.forEach(feed => {
        const data = feed.data as Record<string, unknown>;
        if (data?.signalType === "buy" || data?.signalType === "strong_buy") {
          bullishScore += (data.signalConfidence as number || 0.5) * 0.4;
          totalWeight += 0.4;
        } else if (data?.signalType === "sell" || data?.signalType === "strong_sell") {
          bearishScore += (data.signalConfidence as number || 0.5) * 0.4;
          totalWeight += 0.4;
        }
      });

      // PA 研判权重 35%
      paAnalyses.forEach(feed => {
        const data = feed.data as Record<string, unknown>;
        const bullConf = (data?.bullConfidence as number) || 0;
        const bearConf = (data?.bearConfidence as number) || 0;
        const consensus = data?.consensusSentiment as string;
        
        if (consensus === "bullish") {
          bullishScore += bullConf * 0.35;
          totalWeight += 0.35;
        } else if (consensus === "bearish") {
          bearishScore += bearConf * 0.35;
          totalWeight += 0.35;
        }
      });

      // 预测市场情绪权重 25%
      sentimentFeeds.forEach(feed => {
        const data = feed.data as Record<string, unknown>;
        const sentiment = data?.sentiment as number;
        if (sentiment > 0.6) {
          bullishScore += sentiment * 0.25;
          totalWeight += 0.25;
        } else if (sentiment < 0.4) {
          bearishScore += (1 - sentiment) * 0.25;
          totalWeight += 0.25;
        }
      });

      // 计算置信度和决策
      const confidence = totalWeight > 0 ? Math.abs(bullishScore - bearishScore) / totalWeight : 0;
      let action: "buy" | "sell" | "hold" | "watch";
      let reasoning = "";
      let positionSize: "small" | "medium" | "large" = "small";
      let percentage = 10;

      if (confidence < 0.3) {
        action = "watch";
        reasoning = `信号不明确，建议观望。技术信号${techSignals.length}个，PA研判${paAnalyses.length}个。`;
      } else if (bullishScore > bearishScore) {
        action = confidence > 0.7 ? "buy" : "hold";
        positionSize = confidence > 0.8 ? "large" : confidence > 0.6 ? "medium" : "small";
        percentage = Math.round(confidence * 30); // 最多30%仓位
        reasoning = `综合${techSignals.length}个技术信号和${paAnalyses.length}个PA研判，看涨因素占优。`;
      } else {
        action = confidence > 0.7 ? "sell" : "hold";
        positionSize = confidence > 0.8 ? "large" : confidence > 0.6 ? "medium" : "small";
        percentage = Math.round(confidence * 25);
        reasoning = `综合${techSignals.length}个技术信号和${paAnalyses.length}个PA研判，看跌因素占优。`;
      }

      // 获取当前价格用于计算止损止盈
      const currentPrice = await this.getCurrentPrice(symbol);
      const stopLoss = action === "buy" ? currentPrice * 0.95 : action === "sell" ? currentPrice * 1.05 : undefined;
      const takeProfit = action === "buy" ? currentPrice * 1.1 : action === "sell" ? currentPrice * 0.9 : undefined;

      recommendations.push({
        symbol,
        action,
        confidence: Math.round(confidence * 100) / 100,
        reasoning,
        position: {
          size: positionSize,
          percentage,
        },
        stopLoss,
        takeProfit,
        timeframe: "短期（1-3天）",
      });
    }

    return recommendations;
  }

  /**
   * 获取当前价格（简化版，实际应从缓存或API获取）
   */
  private async getCurrentPrice(symbol: string): Promise<number> {
    const mockPrices: Record<string, number> = {
      BTC: 50000,
      DOGE: 0.15,
      ETH: 3000,
      SOL: 100,
    };
    return mockPrices[symbol] || 100;
  }

  // ==================== 交易执行（简单直接）====================

  // Mock 价格（实际生产环境应从 CoinGecko 获取）
  private mockPrices: Record<string, number> = {
    BTC: 68400,
    DOGE: 0.10,
    ETH: 3500,
    SOL: 150,
    XRP: 0.6,
    ADA: 0.4,
  };

  /**
   * 执行交易
   * 直接调用 Portfolio，不做复杂风控（风控由 PA 决策时控制）
   */
  async executeTrade(params: {
    symbol: string;
    side: 'buy' | 'sell';
    amount?: number;      // 买入金额 (USD)
    quantity?: number;    // 卖出数量
    reason?: string;
  }): Promise<{
    success: boolean;
    trade?: {
      id: string;
      symbol: string;
      side: string;
      quantity: number;
      price: number;
      total: number;
      fee: number;
    };
    portfolio?: {
      totalEquity: number;
      balance: number;
      positions: { symbol: string; quantity: number; avgPrice: number }[];
    };
    error?: string;
  }> {
    const portfolio = getPortfolioManager();

    try {
      // 买入需要 amount，卖出需要 quantity
      if (params.side === 'buy' && !params.amount) {
        return { success: false, error: '买入必须提供 amount (USD)' };
      }
      if (params.side === 'sell' && !params.quantity) {
        return { success: false, error: '卖出必须提供 quantity' };
      }

      // 获取当前价格计算数量
      let quantity = params.quantity || 0;
      const price = this.mockPrices[params.symbol.toUpperCase()] || 100;
      
      if (params.side === 'buy' && params.amount) {
        quantity = params.amount / price;
      }

      // 执行交易
      const result = portfolio.executeTrade({
        symbol: params.symbol.toUpperCase(),
        side: params.side,
        type: 'market',
        quantity,
        price,  // 传入价格
        notes: params.reason || `${params.side.toUpperCase()} ${params.symbol}`,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // 获取更新后的 Portfolio
      const current = portfolio.getPortfolio();

      return {
        success: true,
        trade: result.trade ? {
          id: result.trade.id,
          symbol: result.trade.symbol,
          side: result.trade.side,
          quantity: result.trade.quantity,
          price: result.trade.price,
          total: result.trade.total,
          fee: result.trade.fee,
        } : undefined,
        portfolio: {
          totalEquity: current.totalEquity,
          balance: current.balance,
          positions: current.positions.map(p => ({
            symbol: p.symbol,
            quantity: p.quantity,
            avgPrice: p.avgPrice,
          })),
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '交易执行失败',
      };
    }
  }

  /**
   * 一键分析并执行交易
   */
  async analyzeAndTrade(
    symbols?: string[],
    autoExecute: boolean = false
  ): Promise<{
    analyses: {
      symbol: string;
      action: "buy" | "sell" | "hold" | "watch";
      confidence: number;
      reasoning: string;
      position: {
        size: "small" | "medium" | "large";
        percentage: number;
      };
      stopLoss?: number;
      takeProfit?: number;
      timeframe: string;
    }[];
    executions?: {
      success: boolean;
      trade?: {
        id: string;
        symbol: string;
        side: string;
        quantity: number;
        price: number;
        total: number;
        fee: number;
      };
      portfolio?: {
        totalEquity: number;
        balance: number;
        positions: { symbol: string; quantity: number; avgPrice: number }[];
      };
      error?: string;
    }[];
  }> {
    // 1. 分析
    const analyses = await this.analyzeFromFeed(symbols);
    
    // 2. 如果启用自动执行，执行交易
    const executions: Awaited<ReturnType<typeof this.executeTrade>>[] = [];
    
    if (autoExecute) {
      for (const rec of analyses) {
        // 只执行 buy/sell，跳过 hold/watch
        if (rec.action === 'buy' || rec.action === 'sell') {
          // 根据建议仓位计算金额
          const portfolio = getPortfolioManager();
          const equity = portfolio.getPortfolio().totalEquity;
          const amount = (equity * rec.position.percentage) / 100;

          const result = await this.executeTrade({
            symbol: rec.symbol,
            side: rec.action,
            amount: rec.action === 'buy' ? amount : undefined,
            quantity: rec.action === 'sell' ? rec.position.percentage : undefined, // 这里简化处理
            reason: rec.reasoning,
          });
          
          executions.push(result);
        }
      }
    }

    return { analyses, executions };
  }

  /**
   * 格式化 Feed 分析为交易建议
   */
  formatTradeRecommendation(rec: Awaited<ReturnType<typeof this.analyzeFromFeed>>[0]): string {
    const actionEmoji = rec.action === "buy" ? "🟢 买入" : rec.action === "sell" ? "🔴 卖出" : rec.action === "hold" ? "🟡 持有" : "⚪ 观望";
    const sizeText = rec.position.size === "large" ? "重仓" : rec.position.size === "medium" ? "中仓" : "轻仓";
    
    let response = `**${rec.symbol} 交易建议**\n\n`;
    response += `${actionEmoji} | 置信度: ${(rec.confidence * 100).toFixed(0)}%\n`;
    response += `建议仓位: ${sizeText} (${rec.position.percentage}%)\n\n`;
    response += `💡 **判断依据**: ${rec.reasoning}\n\n`;
    
    if (rec.stopLoss && rec.takeProfit) {
      response += `🛑 止损: $${rec.stopLoss.toFixed(rec.symbol === "DOGE" ? 4 : 0)}\n`;
      response += `🎯 止盈: $${rec.takeProfit.toFixed(rec.symbol === "DOGE" ? 4 : 0)}\n`;
    }
    
    response += `⏰ 时间框架: ${rec.timeframe}`;
    
    return response;
  }

  // ==================== 格式化输出 ====================

  /**
   * 格式化分析结果为对话回复
   */
  formatAnalysisForChat(analysis: CFOAnalysis): string {
    const { symbol, consensus, perspectives, technicalData } = analysis;

    // 如果是错误分析，返回简洁错误信息
    if (analysis.consensus.confidence === 0 && analysis.perspectives.bull.confidence === 0) {
      return `📊 **${symbol} 分析报告**\n\n${analysis.consensus.summary}`;
    }

    let response = `📊 **${symbol} 分析报告**\n\n`;

    // 技术指标概览
    response += `**技术指标：**\n`;
    response += `- RSI: ${technicalData.indicators.rsi}\n`;
    response += `- MA7: $${technicalData.indicators.ma7.toLocaleString()}\n`;
    response += `- MA14: $${technicalData.indicators.ma14.toLocaleString()}\n`;
    response += `- 趋势: ${technicalData.indicators.trend === 'up' ? '上涨' : technicalData.indicators.trend === 'down' ? '下跌' : '横盘'}\n\n`;

    // Bull Case
    response += `🐂 **看涨观点** (${(perspectives.bull.confidence * 100).toFixed(0)}% 置信度)\n`;
    perspectives.bull.keyPoints.slice(0, 2).forEach(point => {
      response += `- ${point}\n`;
    });
    response += `\n`;

    // Bear Case
    response += `🐻 **看跌观点** (${(perspectives.bear.confidence * 100).toFixed(0)}% 置信度)\n`;
    perspectives.bear.keyPoints.slice(0, 2).forEach(point => {
      response += `- ${point}\n`;
    });
    response += `\n`;

    // 结论
    const emoji = consensus.action === "buy" ? "🟢" : consensus.action === "sell" ? "🔴" : "🟡";
    const actionText = consensus.action === "buy" ? "买入" : consensus.action === "sell" ? "卖出" : consensus.action === "watch" ? "观望" : "持有";
    response += `${emoji} **CFO 建议: ${actionText}**\n`;
    response += `置信度: ${(consensus.confidence * 100).toFixed(0)}% | 情绪: ${consensus.sentiment === 'bullish' ? '看涨' : consensus.sentiment === 'bearish' ? '看跌' : '中性'}\n`;
    response += `> ${consensus.summary}`;

    return response;
  }

  /**
   * 格式化市场概览
   */
  formatMarketOverview(overview: {
    analyses: CFOAnalysis[];
    overallSentiment: MarketSentiment;
    topOpportunities: string[];
    topRisks: string[];
    summary: string;
  }): string {
    let response = `🌍 **市场概览**\n\n`;

    const sentimentText = overview.overallSentiment === 'bullish' ? '看涨' : overview.overallSentiment === 'bearish' ? '看跌' : '中性';
    response += `**整体情绪：** ${sentimentText}\n`;
    response += `${overview.summary}\n\n`;

    if (overview.topOpportunities.length > 0) {
      response += `🟢 **机会：** ${overview.topOpportunities.join(", ")}\n`;
    }

    if (overview.topRisks.length > 0) {
      response += `🔴 **风险：** ${overview.topRisks.join(", ")}\n`;
    }

    response += `\n**资产摘要：**\n`;
    for (const analysis of overview.analyses) {
      const emoji = analysis.consensus.sentiment === "bullish" ? "🟢" : analysis.consensus.sentiment === "bearish" ? "🔴" : "⚪";
      const actionText = analysis.consensus.action === "buy" ? "买入" : analysis.consensus.action === "sell" ? "卖出" : analysis.consensus.action === "watch" ? "观望" : "持有";
      response += `${emoji} ${analysis.symbol}: ${actionText} (${(analysis.consensus.confidence * 100).toFixed(0)}%)\n`;
    }

    return response;
  }

  // ==================== 缓存管理 ====================

  private cacheAnalysis(analysis: CFOAnalysis): void {
    this.recentAnalyses.set(analysis.symbol, analysis);

    // 保持缓存大小限制
    if (this.recentAnalyses.size > this.maxCacheSize) {
      const firstKey = this.recentAnalyses.keys().next().value;
      if (firstKey) {
        this.recentAnalyses.delete(firstKey);
      }
    }
  }

  getCachedAnalysis(symbol: string): CFOAnalysis | undefined {
    return this.recentAnalyses.get(symbol);
  }

  getAllCachedAnalyses(): CFOAnalysis[] {
    return Array.from(this.recentAnalyses.values());
  }

  // ==================== 实现抽象方法 ====================

  async executeTask<T>(task: AgentTask): Promise<T> {
    const data = task.data as CFOTask;

    switch (data.type) {
      case "single_analysis": {
        if (!data.symbol) throw new Error("单次分析需要指定币种");
        const result = await this.analyzeSymbol(data.symbol);
        return result as T;
      }

      case "market_overview": {
        const result = await this.getMarketOverview();
        return result as T;
      }

      case "portfolio_review": {
        const symbols = data.portfolio?.map(p => p.symbol) || ["BTC", "ETH"];
        const result = await this.analyzeMultiple(symbols);
        return result as T;
      }

      default:
        throw new Error(`未知的 CFO 任务类型: ${data.type}`);
    }
  }

  protected async generateResponse(
    message: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    const lowerMsg = message.toLowerCase();

    // 市场概览请求
    if (lowerMsg.includes("overview") || lowerMsg.includes("market") || lowerMsg.includes("概览") || lowerMsg.includes("市场")) {
      try {
        const overview = await this.getMarketOverview();
        return this.formatMarketOverview(overview);
      } catch (error) {
        return "获取市场概览时遇到问题，请稍后再试。";
      }
    }

    // 特定币种分析
    const symbolMatch = message.match(/\b(BTC|DOGE|ETH|SOL|XRP|ADA|AVAX|DOT)\b/i);
    if (symbolMatch) {
      const symbol = symbolMatch[0].toUpperCase();
      try {
        // 先检查缓存
        const cached = this.getCachedAnalysis(symbol);
        if (cached && Date.now() - cached.timestamp.getTime() < 5 * 60 * 1000) {
          return this.formatAnalysisForChat(cached) + "\n\n*(缓存数据)*";
        }

        const analysis = await this.analyzeSymbol(symbol);
        return this.formatAnalysisForChat(analysis);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg.includes('429')) {
          return `⏳ API 请求过于频繁，请等待 1-2 分钟后再试。`;
        }
        return `暂时无法分析 ${symbol}，市场数据可能暂时不可用。`;
      }
    }

    // 默认回复
    return `我是你的 CFO 智能助手，可以帮你：\n\n` +
      `📊 **市场分析** - 询问 BTC、DOGE、ETH 等币种\n` +
      `🌍 **市场概览** - 输入"市场概览"查看整体市场状况\n` +
      `💡 **投资建议** - 提供买入/卖出/持有建议\n\n` +
      `你想分析什么？`;
  }
}

// 单例模式导出
let cfoInstance: CFOAgent | null = null;

export function getCFOAgent(): CFOAgent {
  if (!cfoInstance) {
    cfoInstance = new CFOAgent();
  }
  return cfoInstance;
}

export default CFOAgent;
