import type { SkillDefinition, SkillContext } from '../core/types';
import { MarketDatabase } from '../data/market-db';
import path from 'path';

/**
 * 计算 RSI
 */
export function calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length <= period) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change >= 0) gains += change;
        else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        let currentGain = change >= 0 ? change : 0;
        let currentLoss = change < 0 ? -change : 0;

        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

/**
 * 计算简单移动平均线 (SMA)
 */
export function calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    const slice = prices.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
}

/**
 * 计算指数移动平均线 (EMA)
 */
export function calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return calculateSMA(prices, period);

    const k = 2 / (period + 1);
    let ema = calculateSMA(prices.slice(0, period), period);

    for (let i = period; i < prices.length; i++) {
        ema = (prices[i] - ema) * k + ema;
    }

    return ema;
}

/**
 * 计算 MACD
 */
export function calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): { macd: number, signal: number, histogram: number } {
    if (prices.length < slowPeriod + signalPeriod) {
        return { macd: 0, signal: 0, histogram: 0 };
    }

    // 计算 MACD 线: EMA(fast) - EMA(slow)
    // 为了得到 Signal 线，我们需要一系列的 MACD 值
    const macdLine: number[] = [];
    for (let i = slowPeriod; i <= prices.length; i++) {
        const subPrices = prices.slice(0, i);
        const fastEMA = calculateEMA(subPrices, fastPeriod);
        const slowEMA = calculateEMA(subPrices, slowPeriod);
        macdLine.push(fastEMA - slowEMA);
    }

    const signalLine = calculateEMA(macdLine, signalPeriod);
    const currentMACD = macdLine[macdLine.length - 1];

    return {
        macd: currentMACD,
        signal: signalLine,
        histogram: currentMACD - signalLine
    };
}

// ========== 技能定义 ==========

export const TechAnalysisSkills: SkillDefinition[] = [
    {
        id: 'analysis:rsi',
        name: 'RSI 分析',
        description: '计算指定周期的 RSI 指标',
        parameters: [
            { name: 'symbol', type: 'string', required: true, description: '币种' },
            { name: 'period', type: 'number', required: false, description: '计算周期，默认 14' }
        ],
        handler: async (params, context: SkillContext) => {
            const db = MarketDatabase.getInstance();
            await db.init();

            const period = params.period || 14;
            const klines = await db.queryKlines({
                symbol: params.symbol,
                interval: '1m',
                end: context.now ? new Date(context.now) : undefined,
                limit: period * 3
            });

            // db.close();

            if (klines.length === 0) return { error: 'No data' };

            const prices = klines.map(k => k.close);
            const rsi = calculateRSI(prices, period);

            return { symbol: params.symbol, rsi, timestamp: klines[klines.length - 1].timestamp };
        }
    },
    {
        id: 'analysis:trend',
        name: '趋势分析',
        description: '计算短期和长期均线，判断市场趋势',
        parameters: [
            { name: 'symbol', type: 'string', required: true, description: '币种' }
        ],
        handler: async (params, context: SkillContext) => {
            const db = MarketDatabase.getInstance();
            await db.init();

            const klines = await db.queryKlines({
                symbol: params.symbol,
                interval: '1m',
                end: context.now ? new Date(context.now) : undefined,
                limit: 100
            });

            // db.close();

            if (klines.length < 50) return { error: 'Insufficient data' };

            const prices = klines.map(k => k.close);
            const sma7 = calculateSMA(prices, 7);
            const sma25 = calculateSMA(prices, 25);
            const sma50 = calculateSMA(prices, 50);

            let trend: 'up' | 'down' | 'neutral' = 'neutral';
            if (sma7 > sma25 && sma25 > sma50) trend = 'up';
            else if (sma7 < sma25 && sma25 < sma50) trend = 'down';

            return {
                symbol: params.symbol,
                trend,
                indicators: { sma7, sma25, sma50 },
                price: prices[prices.length - 1]
            };
        }
    }
];
