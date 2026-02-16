/**
 * Technical Analyst Agent
 * 技术分析员 - 计算和分析技术指标
 */

import BaseAgent from "./base";
import { getBTCAndDOGEData, getCoinMarketChart, type CoinMarketChart } from "@/lib/data/coingecko";
import type {
  AgentTask,
  TechnicalIndicators,
  TechnicalAnalysis,
  TechnicalSignal,
  SignalType,
} from "@/lib/types";

interface TechAnalysisTask {
  symbol: string;
  coinId?: string; // CoinGecko ID
  days?: string; // 数据天数
}

interface MultiAssetAnalysis {
  analyses: TechnicalAnalysis[];
  timestamp: Date;
}

export class TechnicalAnalyst extends BaseAgent {
  private coinIdMap: Record<string, string> = {
    BTC: "bitcoin",
    DOGE: "dogecoin",
    ETH: "ethereum",
    SOL: "solana",
    XRP: "ripple",
    ADA: "cardano",
    AVAX: "avalanche-2",
    DOT: "polkadot",
  };

  constructor() {
    super({
      name: "TechAnalyst",
      role: "tech-analyst",
      systemPrompt: `你是加密货币市场的技术分析专家。

你的职责：
1. 计算和分析技术指标（RSI、MA、波动率）
2. 识别趋势、支撑位和阻力位
3. 基于技术分析生成买入/卖出/中性信号
4. 提供清晰、数据驱动的洞察

始终保持数字精确，并清楚解释你的推理过程。`,
    });
  }

  // ==================== 核心分析方法 ====================

  /**
   * 计算 RSI (Relative Strength Index)
   * 使用 14 周期标准计算
   */
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) {
      throw new Error(`RSI 计算需要至少 ${period + 1} 个价格点`);
    }

    let gains = 0;
    let losses = 0;

    // 计算初始平均涨跌
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // 使用平滑 RSI 计算
    for (let i = period + 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return Math.round(rsi * 100) / 100;
  }

  /**
   * 计算简单移动平均线 (SMA)
   */
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) {
      throw new Error(`SMA 计算需要至少 ${period} 个价格点`);
    }

    const slice = prices.slice(-period);
    const sum = slice.reduce((acc, price) => acc + price, 0);
    return Math.round((sum / period) * 100) / 100;
  }

  /**
   * 计算指数移动平均线 (EMA)
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) {
      throw new Error(`EMA 计算需要至少 ${period} 个价格点`);
    }

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return Math.round(ema * 100) / 100;
  }

  /**
   * 计算波动率（价格标准差）
   */
  private calculateVolatility(prices: number[], period: number = 14): number {
    if (prices.length < period) return 0;

    const slice = prices.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const squaredDiffs = slice.map(price => Math.pow(price - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(variance);

    // 返回相对波动率（标准差/均值 * 100）
    return Math.round((stdDev / mean) * 100 * 100) / 100;
  }

  /**
   * 识别趋势
   */
  private identifyTrend(prices: number[]): "up" | "down" | "sideways" {
    if (prices.length < 14) return "sideways";

    const ma7 = this.calculateSMA(prices, 7);
    const ma14 = this.calculateSMA(prices, 14);
    const currentPrice = prices[prices.length - 1];

    // 价格相对于均线的位置
    const aboveMa7 = currentPrice > ma7;
    const aboveMa14 = currentPrice > ma14;
    const goldenCross = ma7 > ma14;

    if (aboveMa7 && aboveMa14 && goldenCross) return "up";
    if (!aboveMa7 && !aboveMa14 && !goldenCross) return "down";
    return "sideways";
  }

  /**
   * 计算支撑位和阻力位（简单实现）
   */
  private calculateSupportResistance(
    prices: number[]
  ): { support: number; resistance: number } {
    const window = 10;
    const recentPrices = prices.slice(-window * 3);

    let support = Math.min(...recentPrices);
    let resistance = Math.max(...recentPrices);

    // 稍微调整使其更合理
    support = Math.round(support * 0.995 * 100) / 100;
    resistance = Math.round(resistance * 1.005 * 100) / 100;

    return { support, resistance };
  }

  // ==================== 信号生成 ====================

  /**
   * 基于技术指标生成交易信号
   */
  private generateSignals(
    symbol: string,
    indicators: TechnicalIndicators,
    prices: number[]
  ): TechnicalSignal[] {
    const signals: TechnicalSignal[] = [];

    // RSI 信号
    if (indicators.rsi > 70) {
      signals.push({
        type: "sell",
        indicator: "RSI",
        confidence: Math.min((indicators.rsi - 70) / 30, 1),
        description: `${symbol} RSI 超买 (${indicators.rsi})`,
      });
    } else if (indicators.rsi < 30) {
      signals.push({
        type: "buy",
        indicator: "RSI",
        confidence: Math.min((30 - indicators.rsi) / 30, 1),
        description: `${symbol} RSI 超卖 (${indicators.rsi})`,
      });
    }

    // 移动平均线信号
    const currentPrice = prices[prices.length - 1];
    if (currentPrice > indicators.ma7 && indicators.ma7 > indicators.ma14) {
      signals.push({
        type: "buy",
        indicator: "MA 趋势",
        confidence: 0.7,
        description: `${symbol} 价格在 MA7 之上，MA7 在 MA14 之上 - 看涨趋势`,
      });
    } else if (currentPrice < indicators.ma7 && indicators.ma7 < indicators.ma14) {
      signals.push({
        type: "sell",
        indicator: "MA 趋势",
        confidence: 0.7,
        description: `${symbol} 价格在 MA7 之下，MA7 在 MA14 之下 - 看跌趋势`,
      });
    }

    // 趋势信号
    if (indicators.trend === "up") {
      signals.push({
        type: "buy",
        indicator: "趋势",
        confidence: 0.6,
        description: `${symbol} 处于上涨趋势`,
      });
    } else if (indicators.trend === "down") {
      signals.push({
        type: "sell",
        indicator: "趋势",
        confidence: 0.6,
        description: `${symbol} 处于下跌趋势`,
      });
    }

    // 如果没有明确信号，返回中性
    if (signals.length === 0) {
      signals.push({
        type: "neutral",
        indicator: "综合",
        confidence: 0.5,
        description: `${symbol} 信号混杂，方向不明`,
      });
    }

    return signals;
  }

  /**
   * 计算综合评分
   */
  private calculateCompositeScore(indicators: TechnicalIndicators): number {
    let score = 50; // 基准分

    // RSI 贡献 (-20 to +20)
    score += (50 - indicators.rsi) * 0.4;

    // 趋势贡献
    if (indicators.trend === "up") score += 15;
    if (indicators.trend === "down") score -= 15;

    // 波动率调整（高波动降低信心）
    score -= indicators.volatility * 0.2;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ==================== 公共方法 ====================

  /**
   * 分析单个币种
   */
  async analyzeSymbol(symbol: string, coinId?: string, days: string = "14"): Promise<TechnicalAnalysis> {
    const id = coinId || this.coinIdMap[symbol.toUpperCase()];
    if (!id) {
      throw new Error(`未知币种: ${symbol}`);
    }

    // 获取市场图表数据
    const chartData = await getCoinMarketChart(id, days);
    const prices = chartData.prices.map(p => p[1]);

    if (prices.length < 14) {
      throw new Error(`${symbol} 数据点不足`);
    }

    // 计算指标
    const rsi = this.calculateRSI(prices);
    const ma7 = this.calculateSMA(prices, 7);
    const ma14 = this.calculateSMA(prices, 14);
    const ma30 = prices.length >= 30 ? this.calculateSMA(prices, 30) : undefined;
    const volatility = this.calculateVolatility(prices);
    const trend = this.identifyTrend(prices);
    const { support, resistance } = this.calculateSupportResistance(prices);

    const indicators: TechnicalIndicators = {
      rsi,
      ma7,
      ma14,
      ma30,
      volatility,
      trend,
      support,
      resistance,
    };

    const signals = this.generateSignals(symbol, indicators, prices);

    return {
      symbol: symbol.toUpperCase(),
      indicators,
      signals,
      timestamp: new Date(),
    };
  }

  /**
   * 分析多个币种（用于定时任务）
   */
  async analyzeMultiple(symbols: string[]): Promise<MultiAssetAnalysis> {
    const analyses: TechnicalAnalysis[] = [];

    for (const symbol of symbols) {
      try {
        const analysis = await this.analyzeSymbol(symbol);
        analyses.push(analysis);
      } catch (error) {
        console.error(`[TechAnalyst] Failed to analyze ${symbol}:`, error);
      }
      // 添加小延迟避免请求过快
      await this.delay(500);
    }

    return {
      analyses,
      timestamp: new Date(),
    };
  }

  /**
   * 快速分析 BTC 和 DOGE（每5分钟调用）
   */
  async analyzeBTCAndDOGE(): Promise<MultiAssetAnalysis> {
    return this.analyzeMultiple(["BTC", "DOGE"]);
  }

  /**
   * 生成技术指标摘要
   */
  generateSummary(analysis: TechnicalAnalysis): string {
    const { symbol, indicators, signals } = analysis;
    const compositeScore = this.calculateCompositeScore(indicators);

    const bullishSignals = signals.filter(s => s.type === "buy" || s.type === "strong_buy");
    const bearishSignals = signals.filter(s => s.type === "sell" || s.type === "strong_sell");

    const trendText = indicators.trend === 'up' ? '上涨' : indicators.trend === 'down' ? '下跌' : '横盘';

    let summary = `[${symbol}] 技术评分: ${compositeScore}/100\n`;
    summary += `RSI: ${indicators.rsi} | MA7: $${indicators.ma7} | MA14: $${indicators.ma14}\n`;
    summary += `趋势: ${trendText} | 波动率: ${indicators.volatility}%\n`;
    summary += `信号: ${bullishSignals.length} 个看涨, ${bearishSignals.length} 个看跌\n`;

    if (signals.length > 0) {
      summary += `主要信号: ${signals[0].description}`;
    }

    return summary;
  }

  // ==================== 实现抽象方法 ====================

  async executeTask<T>(task: AgentTask): Promise<T> {
    switch (task.type) {
      case "analyze_symbol": {
        const { symbol, coinId, days } = task.data as TechAnalysisTask;
        const result = await this.analyzeSymbol(symbol, coinId, days);
        return result as T;
      }

      case "analyze_multiple": {
        const { symbols } = task.data as { symbols: string[] };
        const result = await this.analyzeMultiple(symbols);
        return result as T;
      }

      case "analyze_btc_doge": {
        const result = await this.analyzeBTCAndDOGE();
        return result as T;
      }

      default:
        throw new Error(`未知的任务类型: ${task.type}`);
    }
  }

  protected async generateResponse(
    message: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    // 技术分析员主要是数据分析，对话功能简单实现
    if (message.toLowerCase().includes("analyze") || message.toLowerCase().includes("分析")) {
      const symbol = message.match(/\b(BTC|DOGE|ETH|SOL|XRP|ADA)\b/i)?.[0] || "BTC";
      try {
        const analysis = await this.analyzeSymbol(symbol);
        return this.generateSummary(analysis);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg.includes('429')) {
          return `⏳ API 请求过于频繁，请等待 1-2 分钟后再试。`;
        }
        return `抱歉，暂时无法分析 ${symbol}。请稍后再试。`;
      }
    }

    return `我是技术分析员，可以帮你分析加密货币的技术指标。让我分析 BTC、DOGE 或其他支持的币种。`;
  }
}

// 单例模式导出
let techAnalystInstance: TechnicalAnalyst | null = null;

export function getTechnicalAnalyst(): TechnicalAnalyst {
  if (!techAnalystInstance) {
    techAnalystInstance = new TechnicalAnalyst();
  }
  return techAnalystInstance;
}

export default TechnicalAnalyst;
