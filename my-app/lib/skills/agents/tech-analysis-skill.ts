/**
 * 技术分析 Skill
 * 
 * 技术分析员的核心 Skill，包含:
 * 1. 获取市场数据 (使用 coingecko Tools)
 * 2. 计算技术指标
 * 3. 生成分析信号
 * 4. 发布 Feed (调用 feed:publish Skill)
 */

import type { Skill, SkillContext, SkillResult } from '../types';

export const TechnicalAnalysisSkill: Skill = {
  // ========== 元数据 ==========
  id: 'technical:analyze',
  name: '技术分析',
  description: '分析币种的技术指标，生成买入/卖出/观望信号',
  category: 'analyst',
  version: '1.0.0',

  // ========== 核心指令 (Anthropic 风格) ==========
  instructions: {
    system: `你是技术分析专家。你的任务是基于价格数据计算技术指标，并给出专业的交易信号。

分析框架:
1. 趋势判断 - 使用移动平均线(MA7, MA14, MA30)判断趋势方向
2. 动量分析 - 计算 RSI 判断超买超卖状态
3. 形态识别 - 识别金叉/死叉、突破等关键形态
4. 信号生成 - 综合以上给出 LONG/SHORT/HOLD/WATCH 信号

输出规范:
- signal: 必须是 LONG/SHORT/HOLD/WATCH 之一
- confidence: 0-1 之间的浮点数
- reasoning: 简洁的核心理由，不超过 100 字
- keyIndicators: 列出关键指标数值`,

    context: '你在 CryptoPulse 系统中工作，接收实时价格数据，输出结构化分析结果。CFO 会使用你的分析进行决策。',

    reasoning: `分析流程:
1. 计算 RSI (14周期)
   - RSI > 70: 超买，可能回调 (Bearish)
   - RSI < 30: 超卖，可能反弹 (Bullish)
   - RSI 30-70: 正常区间 (Neutral)

2. 计算移动平均线
   - MA7 > MA14 > MA30: 多头排列 (Bullish)
   - MA7 < MA14 < MA30: 空头排列 (Bearish)
   - 其他: 震荡 (Neutral)

3. 识别形态
   - MA7 上穿 MA14: 金叉 (Bullish)
   - MA7 下穿 MA14: 死叉 (Bearish)
   - 价格突破 24h 高点: 突破信号 (Bullish)

4. 综合评分
   - 每个 Bullish 信号 +0.25
   - 每个 Bearish 信号 -0.25
   - 最终 confidence = 0.5 + 总分，限制在 0-1 范围`,

    constraints: [
      '不预测未来价格，只基于已有数据研判',
      '每个信号必须有明确的指标支撑',
      '置信度低于 0.6 时必须输出 WATCH',
      '趋势不明时宁可给出 WATCH 也不强行判断',
    ],
  },

  // ========== 工具依赖 ==========
  tools: {
    required: [
      'coingecko:get_btc_doge',  // 获取 BTC/DOGE 数据
    ],
    optional: [
      'coingecko:get_price',
      'coingecko:get_chart',
    ],
  },

  // ========== 输入/输出 ==========
  inputSchema: {
    type: 'object',
    properties: {
      symbols: {
        type: 'array',
        items: { type: 'string' },
        description: '要分析的币种列表',
        default: ['BTC', 'DOGE'],
      },
    },
    required: [],
  },

  outputSchema: {
    type: 'object',
    properties: {
      analyses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            signal: { type: 'string', enum: ['LONG', 'SHORT', 'HOLD', 'WATCH'] },
            confidence: { type: 'number' },
            reasoning: { type: 'string' },
            indicators: { type: 'object' },
          },
        },
      },
    },
    required: ['analyses'],
  },

  // ========== 参考资料 ==========
  references: {
    examples: [
      {
        input: { symbols: ['BTC'] },
        output: {
          analyses: [{
            symbol: 'BTC',
            signal: 'LONG',
            confidence: 0.75,
            reasoning: 'MA7 上穿 MA14 形成金叉，RSI 65 处于健康区间，多头趋势明显',
            indicators: { rsi: 65, ma7: 44500, ma14: 44000, trend: 'up' },
          }],
        },
        explanation: '多头排列 + RSI 健康 = 看涨信号',
      },
      {
        input: { symbols: ['DOGE'] },
        output: {
          analyses: [{
            symbol: 'DOGE',
            signal: 'WATCH',
            confidence: 0.5,
            reasoning: '价格在 MA 下方运行，趋势偏弱但 RSI 未超卖，建议观望等待明确方向',
            indicators: { rsi: 45, ma7: 0.12, ma14: 0.13, trend: 'down' },
          }],
        },
        explanation: '趋势向下但未到极端，等待明确信号',
      },
    ],
  },

  // ========== 触发规则 ==========
  triggers: [
    { type: 'cron', schedule: '*/5 * * * *', timezone: 'UTC' },  // 每5分钟
  ],

  // ========== 执行函数 ==========
  execute: async (context: SkillContext): Promise<SkillResult> => {
    const symbols = context.input.symbols || ['BTC', 'DOGE'];
    const startTime = Date.now();

    try {
      // 1. 获取市场数据 (使用 Tool)
      const marketData = await context.tools.get('coingecko:get_btc_doge')?.execute({});
      
      if (!marketData) {
        return {
          success: false,
          error: '无法获取市场数据',
        };
      }

      // 2. 分析每个币种
      const analyses = symbols.map((symbol: string) => {
        const prices = symbol === 'BTC' 
          ? marketData.btcChart.prices.map((p: number[]) => p[1])
          : marketData.dogeChart.prices.map((p: number[]) => p[1]);

        // 计算技术指标
        const rsi = calculateRSI(prices);
        const ma7 = calculateMA(prices, 7);
        const ma14 = calculateMA(prices, 14);
        const trend = determineTrend(ma7, ma14);
        
        // 生成信号
        const { signal, confidence, reasoning } = generateSignal(
          rsi, ma7, ma14, trend, symbol
        );

        return {
          symbol,
          signal,
          confidence,
          reasoning,
          indicators: {
            rsi: Math.round(rsi * 100) / 100,
            ma7: Math.round(ma7 * 100) / 100,
            ma14: Math.round(ma14 * 100) / 100,
            trend,
          },
        };
      });

      return {
        success: true,
        data: { analyses },
        metadata: {
          executionTime: Date.now() - startTime,
          toolsUsed: ['coingecko:get_btc_doge'],
        },
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMsg,
        metadata: { executionTime: Date.now() - startTime },
      };
    }
  },
};

// ==================== 技术指标计算函数 ====================

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calculateMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];
  const slice = prices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

function determineTrend(ma7: number, ma14: number): 'up' | 'down' | 'sideways' {
  if (ma7 > ma14 * 1.01) return 'up';
  if (ma7 < ma14 * 0.99) return 'down';
  return 'sideways';
}

function generateSignal(
  rsi: number,
  ma7: number,
  ma14: number,
  trend: 'up' | 'down' | 'sideways',
  symbol: string
): { signal: string; confidence: number; reasoning: string } {
  let score = 0;
  const reasons: string[] = [];

  // RSI 评分
  if (rsi < 30) {
    score += 0.25;
    reasons.push('RSI 超卖');
  } else if (rsi > 70) {
    score -= 0.25;
    reasons.push('RSI 超买');
  }

  // 趋势评分
  if (trend === 'up') {
    score += 0.25;
    reasons.push('均线多头排列');
  } else if (trend === 'down') {
    score -= 0.25;
    reasons.push('均线空头排列');
  }

  // 金叉/死叉
  if (ma7 > ma14 && ma7 < ma14 * 1.02) {
    score += 0.25;
    reasons.push('MA7 即将金叉 MA14');
  }

  // 计算置信度和信号
  const confidence = Math.max(0.3, Math.min(0.95, 0.5 + score));
  
  let signal: string;
  if (confidence > 0.7 && score > 0) {
    signal = 'LONG';
  } else if (confidence > 0.7 && score < 0) {
    signal = 'SHORT';
  } else if (confidence < 0.5) {
    signal = 'WATCH';
  } else {
    signal = 'HOLD';
  }

  return {
    signal,
    confidence,
    reasoning: `${symbol} ${reasons.join('，')}，${signal === 'LONG' ? '建议做多' : signal === 'SHORT' ? '建议做空' : signal === 'WATCH' ? '建议观望' : '建议持有'}`,
  };
}

export default TechnicalAnalysisSkill;
