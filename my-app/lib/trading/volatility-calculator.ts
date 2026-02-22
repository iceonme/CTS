/**
 * 波动率计算器 (Volatility Calculator)
 * 
 * 计算给定K线窗口内的价格波动幅度。
 * 用于判断当前市场是否适合高抛低吸策略。
 */

import { KlineData } from '../data/market-db';

export interface VolatilityResult {
    volatility: number;       // 波动率百分比（如 4.5 代表 4.5%）
    highest: number;          // 窗口内最高价
    lowest: number;           // 窗口内最低价
    inRange: boolean;         // 是否在可接受范围内
}

/**
 * 计算K线窗口内的价格波动率
 * @param klines K线数组
 * @returns 波动率百分比 = (最高价 - 最低价) / 最低价 × 100
 */
export function calculateVolatility(klines: KlineData[]): number {
    if (klines.length === 0) return 0;

    let highest = -Infinity;
    let lowest = Infinity;

    for (const kline of klines) {
        if (kline.high > highest) highest = kline.high;
        if (kline.low < lowest) lowest = kline.low;
    }

    if (lowest === 0) return 0;

    return ((highest - lowest) / lowest) * 100;
}

/**
 * 计算波动率并判断是否在可接受范围内
 * @param klines K线数组
 * @param minPercent 最低波动率阈值（%）
 * @param maxPercent 最高波动率阈值（%）
 * @returns 波动率结果，包含是否在范围内的判断
 */
export function analyzeVolatility(
    klines: KlineData[],
    minPercent: number,
    maxPercent: number
): VolatilityResult {
    if (klines.length === 0) {
        return { volatility: 0, highest: 0, lowest: 0, inRange: false };
    }

    let highest = -Infinity;
    let lowest = Infinity;

    for (const kline of klines) {
        if (kline.high > highest) highest = kline.high;
        if (kline.low < lowest) lowest = kline.low;
    }

    const volatility = lowest === 0 ? 0 : ((highest - lowest) / lowest) * 100;

    return {
        volatility,
        highest,
        lowest,
        inRange: volatility >= minPercent && volatility <= maxPercent
    };
}
