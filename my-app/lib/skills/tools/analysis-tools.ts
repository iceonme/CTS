/**
 * 分析层 Tools - 技术指标计算工具集（纯计算函数，客户端安全）
 * 
 * 注意：此文件只包含纯数学计算函数，不涉及数据库操作
 * 完整的 Tool 定义（含数据库）在服务端注册
 */

// ============================================
// 核心计算函数（纯数学，无依赖）
// ============================================

/**
 * 计算 RSI (Relative Strength Index)
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
 * 计算 SMA (Simple Moving Average)
 */
export function calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    const slice = prices.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
}

/**
 * 计算 EMA (Exponential Moving Average)
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
export function calculateMACD(
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
): { macd: number; signal: number; histogram: number; trend: 'bullish' | 'bearish' | 'neutral' } {
    if (prices.length < slowPeriod + signalPeriod) {
        return { macd: 0, signal: 0, histogram: 0, trend: 'neutral' };
    }

    const macdLine: number[] = [];
    for (let i = slowPeriod; i <= prices.length; i++) {
        const subPrices = prices.slice(0, i);
        const fastEMA = calculateEMA(subPrices, fastPeriod);
        const slowEMA = calculateEMA(subPrices, slowPeriod);
        macdLine.push(fastEMA - slowEMA);
    }

    // 计算完整的 signal 序列，以便做交叉检测
    const signalLine: number[] = [];
    for (let i = signalPeriod; i <= macdLine.length; i++) {
        signalLine.push(calculateEMA(macdLine.slice(0, i), signalPeriod));
    }

    const currentMACD = macdLine[macdLine.length - 1];
    const currentSignal = signalLine[signalLine.length - 1];
    const histogram = currentMACD - currentSignal;

    // 金叉/死叉判断：比较当前和前一根的 MACD vs Signal
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (signalLine.length >= 2 && macdLine.length >= macdLine.length) {
        const prevMACD = macdLine[macdLine.length - 2];
        const prevSignal = signalLine[signalLine.length - 2];
        // 金叉：前一根 MACD <= Signal，当前 MACD > Signal
        if (prevMACD <= prevSignal && currentMACD > currentSignal) {
            trend = 'bullish';
        }
        // 死叉：前一根 MACD >= Signal，当前 MACD < Signal
        else if (prevMACD >= prevSignal && currentMACD < currentSignal) {
            trend = 'bearish';
        }
    }

    return { macd: currentMACD, signal: currentSignal, histogram, trend };
}

// ============================================
// 服务端 Tool 注册（动态导入，避免客户端加载）
// ============================================

import type { Tool } from '../types';

// 服务端函数：创建 Tools（需要在服务端调用）
export function createAnalysisTools(marketDb: any): Tool[] {
    const RSITool: Tool = {
        id: 'indicator:rsi',
        name: 'RSI Calculator',
        description: 'Calculate Relative Strength Index for given price data',
        parameters: {
            type: 'object',
            properties: {
                symbol: { type: 'string', description: 'Trading symbol (e.g., BTCUSDT)' },
                period: { type: 'number', description: 'RSI period, default 14', default: 14 },
                endTime: { type: 'string', description: 'End time ISO string' }
            },
            required: ['symbol']
        },
        execute: async (params) => {
            const { symbol, period = 14, endTime } = params;
            const klines = await marketDb.queryKlines({
                symbol,
                interval: '1m',
                end: endTime ? new Date(endTime) : undefined,
                limit: period * 3
            });

            if (klines.length === 0) {
                return { success: false, error: 'No data available' };
            }

            const prices = klines.map((k: any) => k.close);
            const rsi = calculateRSI(prices, period);
            const currentPrice = prices[prices.length - 1];

            let status: 'oversold' | 'overbought' | 'neutral' = 'neutral';
            if (rsi < 30) status = 'oversold';
            else if (rsi > 70) status = 'overbought';

            return {
                success: true,
                data: {
                    symbol,
                    rsi: Math.round(rsi * 100) / 100,
                    period,
                    status,
                    currentPrice,
                    timestamp: klines[klines.length - 1].timestamp
                }
            };
        }
    };

    const MATool: Tool = {
        id: 'indicator:ma',
        name: 'Moving Average Calculator',
        description: 'Calculate SMA and EMA for multiple periods',
        parameters: {
            type: 'object',
            properties: {
                symbol: { type: 'string', description: 'Trading symbol' },
                periods: {
                    type: 'array',
                    items: { type: 'number' },
                    description: 'MA periods to calculate, default [7, 25, 50]',
                    default: [7, 25, 50]
                },
                endTime: { type: 'string', description: 'End time ISO string' }
            },
            required: ['symbol']
        },
        execute: async (params) => {
            const { symbol, periods = [7, 25, 50], endTime } = params;
            const maxPeriod = Math.max(...periods);
            const klines = await marketDb.queryKlines({
                symbol,
                interval: '1m',
                end: endTime ? new Date(endTime) : undefined,
                limit: maxPeriod * 3
            });

            if (klines.length < maxPeriod) {
                return { success: false, error: 'Insufficient data' };
            }

            const prices = klines.map((k: any) => k.close);
            const currentPrice = prices[prices.length - 1];

            const sma: Record<number, number> = {};
            const ema: Record<number, number> = {};

            for (const p of periods) {
                sma[p] = Math.round(calculateSMA(prices, p) * 100) / 100;
                ema[p] = Math.round(calculateEMA(prices, p) * 100) / 100;
            }

            const sma7 = sma[7] || 0;
            const sma25 = sma[25] || 0;
            const sma50 = sma[50] || 0;

            let alignment: 'bullish' | 'bearish' | 'mixed' = 'mixed';
            if (sma7 > sma25 && sma25 > sma50) alignment = 'bullish';
            else if (sma7 < sma25 && sma25 < sma50) alignment = 'bearish';

            return {
                success: true,
                data: {
                    symbol,
                    currentPrice,
                    sma,
                    ema,
                    alignment,
                    periods,
                    timestamp: klines[klines.length - 1].timestamp
                }
            };
        }
    };

    const MACDTool: Tool = {
        id: 'indicator:macd',
        name: 'MACD Calculator',
        description: 'Calculate MACD indicator',
        parameters: {
            type: 'object',
            properties: {
                symbol: { type: 'string', description: 'Trading symbol' },
                endTime: { type: 'string', description: 'End time ISO string' }
            },
            required: ['symbol']
        },
        execute: async (params) => {
            const { symbol, endTime } = params;
            const klines = await marketDb.queryKlines({
                symbol,
                interval: '1m',
                end: endTime ? new Date(endTime) : undefined,
                limit: 60
            });

            if (klines.length < 35) {
                return { success: false, error: 'Insufficient data' };
            }

            const prices = klines.map((k: any) => k.close);
            const macd = calculateMACD(prices);

            return {
                success: true,
                data: {
                    symbol,
                    macd: Math.round(macd.macd * 100) / 100,
                    signal: Math.round(macd.signal * 100) / 100,
                    histogram: Math.round(macd.histogram * 100) / 100,
                    trend: macd.trend,
                    currentPrice: prices[prices.length - 1],
                    timestamp: klines[klines.length - 1].timestamp
                }
            };
        }
    };

    return [RSITool, MATool, MACDTool];
}

export default { calculateRSI, calculateSMA, calculateEMA, calculateMACD, createAnalysisTools };
