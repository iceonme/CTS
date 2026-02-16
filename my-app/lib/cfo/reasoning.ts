/**
 * CFO Bull/Bear 推理引擎
 * 实现双视角分析机制：同时从看涨和看跌角度分析市场
 */

import type {
  TechnicalAnalysis,
  MarketSentiment,
  CFOPerspective,
  CFOAnalysis,
  SignalType,
} from "@/lib/types";

// ==================== 推理上下文 ====================

interface ReasoningContext {
  technicalAnalysis: TechnicalAnalysis;
  marketContext?: {
    btcDominance?: number;
    marketSentiment?: string;
    fearGreedIndex?: number;
  };
  historicalContext?: {
    lastAnalysis?: CFOAnalysis;
    priceChange24h?: number;
    volumeChange24h?: number;
  };
}

// ==================== Bull 推理器（看涨视角） ====================

class BullReasoner {
  private context: ReasoningContext;

  constructor(context: ReasoningContext) {
    this.context = context;
  }

  /**
   * 生成看涨理由
   */
  generateReasoning(): { points: string[]; confidence: number } {
    const { technicalAnalysis } = this.context;
    const { indicators, signals } = technicalAnalysis;
    const points: string[] = [];
    let confidenceScore = 50; // 基础信心分

    // 1. RSI 超卖反弹机会
    if (indicators.rsi < 35) {
      points.push(`RSI at ${indicators.rsi} indicates oversold conditions - potential bounce incoming`);
      confidenceScore += 15;
    } else if (indicators.rsi >= 50 && indicators.rsi < 65) {
      points.push(`RSI at ${indicators.rsi} shows healthy momentum with room to grow`);
      confidenceScore += 8;
    }

    // 2. 均线多头排列
    if (indicators.trend === "up") {
      points.push("Price is in an uptrend with MA7 above MA14 - bullish momentum");
      confidenceScore += 12;
    }

    // 3. 价格与支撑位关系
    if (indicators.support) {
      const currentPrice = technicalAnalysis.signals[0]?.description.includes("price above")
        ? indicators.ma7 * 1.02 // 估算当前价格
        : indicators.ma7;
      
      const supportDistance = ((currentPrice - indicators.support) / currentPrice) * 100;
      if (supportDistance < 5) {
        points.push(`Price is near support at $${indicators.support} - good risk/reward entry`);
        confidenceScore += 10;
      }
    }

    // 4. 波动率分析
    if (indicators.volatility < 5) {
      points.push(`Low volatility (${indicators.volatility}%) suggests consolidation before potential breakout`);
      confidenceScore += 5;
    }

    // 5. 技术指标信号
    const bullishSignals = signals.filter(s => s.type === "buy" || s.type === "strong_buy");
    if (bullishSignals.length > 0) {
      points.push(`${bullishSignals.length} bullish signal(s) detected: ${bullishSignals[0].description}`);
      confidenceScore += bullishSignals.length * 5;
    }

    // 6. 历史背景
    if (this.context.historicalContext?.priceChange24h !== undefined) {
      const change = this.context.historicalContext.priceChange24h;
      if (change > 5) {
        points.push(`Strong 24h performance (+${change.toFixed(2)}%) indicates positive momentum`);
        confidenceScore += 8;
      } else if (change > 0 && change < 3) {
        points.push(`Steady 24h gain (+${change.toFixed(2)}%) shows sustainable growth`);
        confidenceScore += 4;
      }
    }

    // 如果没有找到理由，提供默认乐观视角
    if (points.length === 0) {
      points.push("Market structure remains intact - dip buying opportunity");
      confidenceScore = 40;
    }

    return {
      points,
      confidence: Math.min(confidenceScore, 95) / 100,
    };
  }
}

// ==================== Bear 推理器（看跌视角） ====================

class BearReasoner {
  private context: ReasoningContext;

  constructor(context: ReasoningContext) {
    this.context = context;
  }

  /**
   * 生成看跌理由
   */
  generateReasoning(): { points: string[]; confidence: number } {
    const { technicalAnalysis } = this.context;
    const { indicators, signals } = technicalAnalysis;
    const points: string[] = [];
    let confidenceScore = 50;

    // 1. RSI 超买风险
    if (indicators.rsi > 70) {
      points.push(`RSI at ${indicators.rsi} indicates overbought conditions - correction likely`);
      confidenceScore += 20;
    } else if (indicators.rsi > 60 && indicators.rsi <= 70) {
      points.push(`RSI at ${indicators.rsi} approaching overbought territory`);
      confidenceScore += 8;
    }

    // 2. 均线空头排列
    if (indicators.trend === "down") {
      points.push("Price is in a downtrend with MA7 below MA14 - bearish momentum");
      confidenceScore += 15;
    }

    // 3. 价格与阻力位关系
    if (indicators.resistance) {
      const estimatedPrice = indicators.ma7;
      const resistanceDistance = ((indicators.resistance - estimatedPrice) / estimatedPrice) * 100;
      if (resistanceDistance < 5) {
        points.push(`Price approaching resistance at $${indicators.resistance} - limited upside`);
        confidenceScore += 10;
      }
    }

    // 4. 高波动率风险
    if (indicators.volatility > 10) {
      points.push(`High volatility (${indicators.volatility}%) increases downside risk`);
      confidenceScore += 8;
    }

    // 5. 技术指标信号
    const bearishSignals = signals.filter(s => s.type === "sell" || s.type === "strong_sell");
    if (bearishSignals.length > 0) {
      points.push(`${bearishSignals.length} bearish signal(s) detected: ${bearishSignals[0].description}`);
      confidenceScore += bearishSignals.length * 6;
    }

    // 6. 历史背景
    if (this.context.historicalContext?.priceChange24h !== undefined) {
      const change = this.context.historicalContext.priceChange24h;
      if (change < -5) {
        points.push(`Sharp 24h decline (${change.toFixed(2)}%) indicates selling pressure`);
        confidenceScore += 12;
      } else if (change < -2) {
        points.push(`Negative 24h performance (${change.toFixed(2)}%) shows weakness`);
        confidenceScore += 6;
      }
    }

    // 如果没有找到理由，提供默认悲观视角
    if (points.length === 0) {
      points.push("Market showing early signs of exhaustion - caution warranted");
      confidenceScore = 35;
    }

    return {
      points,
      confidence: Math.min(confidenceScore, 95) / 100,
    };
  }
}

// ==================== CFO 推理引擎 ====================

export class CFOReasoningEngine {
  private bullReasoner: BullReasoner;
  private bearReasoner: BearReasoner;

  constructor(context: ReasoningContext) {
    this.bullReasoner = new BullReasoner(context);
    this.bearReasoner = new BearReasoner(context);
  }

  /**
   * 执行双视角分析
   */
  analyze(): {
    bull: CFOPerspective;
    bear: CFOPerspective;
    consensus: {
      sentiment: MarketSentiment;
      confidence: number;
      summary: string;
      action: "buy" | "sell" | "hold" | "watch";
    };
  } {
    const bullResult = this.bullReasoner.generateReasoning();
    const bearResult = this.bearReasoner.generateReasoning();

    const bullPerspective: CFOPerspective = {
      mode: "bull",
      confidence: bullResult.confidence,
      reasoning: bullResult.points.join("; "),
      keyPoints: bullResult.points,
      riskLevel: this.calculateRiskLevel("bull", bullResult.confidence),
    };

    const bearPerspective: CFOPerspective = {
      mode: "bear",
      confidence: bearResult.confidence,
      reasoning: bearResult.points.join("; "),
      keyPoints: bearResult.points,
      riskLevel: this.calculateRiskLevel("bear", bearResult.confidence),
    };

    const consensus = this.generateConsensus(bullPerspective, bearPerspective);

    return {
      bull: bullPerspective,
      bear: bearPerspective,
      consensus,
    };
  }

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(
    mode: "bull" | "bear",
    confidence: number
  ): "low" | "medium" | "high" {
    if (confidence > 0.75) return "high";
    if (confidence > 0.5) return "medium";
    return "low";
  }

  /**
   * 生成综合结论
   */
  private generateConsensus(
    bull: CFOPerspective,
    bear: CFOPerspective
  ): {
    sentiment: MarketSentiment;
    confidence: number;
    summary: string;
    action: "buy" | "sell" | "hold" | "watch";
  } {
    const bullStrength = bull.confidence;
    const bearStrength = bear.confidence;
    const diff = Math.abs(bullStrength - bearStrength);

    let sentiment: MarketSentiment;
    let action: "buy" | "sell" | "hold" | "watch";
    let summary: string;

    if (diff < 0.15) {
      // 双方力量接近
      sentiment = "neutral";
      action = "watch";
      summary = "Market is at equilibrium. Both bullish and bearish cases have merit. Best to observe and wait for clearer signals.";
    } else if (bullStrength > bearStrength) {
      sentiment = "bullish";
      if (diff > 0.3 && bullStrength > 0.7) {
        action = "buy";
        summary = `Strong bullish case with ${(bullStrength * 100).toFixed(0)}% confidence. ${bull.keyPoints[0]}`;
      } else {
        action = "hold";
        summary = `Moderately bullish outlook. ${bull.keyPoints[0]} However, bearish factors warrant caution.`;
      }
    } else {
      sentiment = "bearish";
      if (diff > 0.3 && bearStrength > 0.7) {
        action = "sell";
        summary = `Strong bearish case with ${(bearStrength * 100).toFixed(0)}% confidence. ${bear.keyPoints[0]}`;
      } else {
        action = "hold";
        summary = `Moderately bearish outlook. ${bear.keyPoints[0]} Consider reducing exposure or waiting for better entry.`;
      }
    }

    return {
      sentiment,
      confidence: diff,
      summary,
      action,
    };
  }
}

// ==================== 工厂函数 ====================

/**
 * 分析技术分析数据并生成 CFO 视角
 */
export function analyzeWithCFO(
  technicalAnalysis: TechnicalAnalysis,
  options?: {
    marketContext?: ReasoningContext["marketContext"];
    historicalContext?: ReasoningContext["historicalContext"];
  }
): CFOAnalysis {
  const context: ReasoningContext = {
    technicalAnalysis,
    marketContext: options?.marketContext,
    historicalContext: options?.historicalContext,
  };

  const engine = new CFOReasoningEngine(context);
  const result = engine.analyze();

  return {
    id: generateAnalysisId(),
    symbol: technicalAnalysis.symbol,
    timestamp: new Date(),
    perspectives: {
      bull: result.bull,
      bear: result.bear,
    },
    consensus: result.consensus,
    technicalData: technicalAnalysis,
  };
}

/**
 * 批量分析多个币种
 */
export function analyzeMultipleWithCFO(
  analyses: TechnicalAnalysis[],
  options?: {
    marketContext?: ReasoningContext["marketContext"];
  }
): CFOAnalysis[] {
  return analyses.map(analysis =>
    analyzeWithCFO(analysis, {
      marketContext: options?.marketContext,
      historicalContext: {
        lastAnalysis: undefined, // 可以传入之前的分析
      },
    })
  );
}

/**
 * 生成分析 ID
 */
function generateAnalysisId(): string {
  return `cfo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== 导出 ====================

export default analyzeWithCFO;
