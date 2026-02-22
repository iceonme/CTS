/**
 * 枢轴点检测器 (Pivot Point Detector)
 * 
 * 从K线数据中识别局部极值点（支撑/阻力位）。
 * 枢轴低点：某根K线的 low 比左右各 N 根K线的 low 都低。
 * 枢轴高点：某根K线的 high 比左右各 N 根K线的 high 都高。
 */

import { KlineData } from '../data/market-db';

export interface PivotPoint {
    index: number;       // 在K线数组中的索引
    price: number;       // 价格（low 或 high）
    timestamp: number;   // 时间戳
}

export interface PivotResult {
    lows: PivotPoint[];   // 枢轴低点列表（按时间排序，最早在前）
    highs: PivotPoint[];  // 枢轴高点列表（按时间排序，最早在前）
}

/**
 * 查找所有枢轴低点
 * @param klines K线数组（按时间升序排列）
 * @param n 左右比较的K线根数
 * @returns 枢轴低点数组
 */
export function findPivotLows(klines: KlineData[], n: number): PivotPoint[] {
    const pivots: PivotPoint[] = [];

    // 需要至少 2*n+1 根K线才能判断
    if (klines.length < 2 * n + 1) return pivots;

    for (let i = n; i < klines.length - n; i++) {
        const currentLow = klines[i].low;
        let isPivot = true;

        // 检查左边 N 根
        for (let j = 1; j <= n; j++) {
            if (klines[i - j].low <= currentLow) {
                isPivot = false;
                break;
            }
        }

        // 检查右边 N 根
        if (isPivot) {
            for (let j = 1; j <= n; j++) {
                if (klines[i + j].low <= currentLow) {
                    isPivot = false;
                    break;
                }
            }
        }

        if (isPivot) {
            pivots.push({
                index: i,
                price: currentLow,
                timestamp: klines[i].timestamp
            });
        }
    }

    return pivots;
}

/**
 * 查找所有枢轴高点
 * @param klines K线数组（按时间升序排列）
 * @param n 左右比较的K线根数
 * @returns 枢轴高点数组
 */
export function findPivotHighs(klines: KlineData[], n: number): PivotPoint[] {
    const pivots: PivotPoint[] = [];

    if (klines.length < 2 * n + 1) return pivots;

    for (let i = n; i < klines.length - n; i++) {
        const currentHigh = klines[i].high;
        let isPivot = true;

        // 检查左边 N 根
        for (let j = 1; j <= n; j++) {
            if (klines[i - j].high >= currentHigh) {
                isPivot = false;
                break;
            }
        }

        // 检查右边 N 根
        if (isPivot) {
            for (let j = 1; j <= n; j++) {
                if (klines[i + j].high >= currentHigh) {
                    isPivot = false;
                    break;
                }
            }
        }

        if (isPivot) {
            pivots.push({
                index: i,
                price: currentHigh,
                timestamp: klines[i].timestamp
            });
        }
    }

    return pivots;
}

/**
 * 获取最近或最相关的枢轴高低点
 * @param klines K线数组（按时间升序排列）
 * @param n 枢轴点比较窗口
 * @param count 需要返回的高/低点数量
 * @param refPrice 参考价格（如当前价），如果不传则按时间取最近
 * @returns 选出的 count 个高点价格和 count 个低点价格
 */
export function getRecentPivots(
    klines: KlineData[],
    n: number,
    count: number,
    refPrice?: number
): { lows: number[], highs: number[] } {
    const allLows = findPivotLows(klines, n);
    const allHighs = findPivotHighs(klines, n);

    let selectedLows: number[];
    let selectedHighs: number[];

    if (refPrice !== undefined) {
        // 基于价格接近度进行选择（优先取离当前价最近的枢轴点，无论时间先后）
        // 这样可以确保网格始终围绕当前价格，而不是被历史极值拉偏
        selectedLows = allLows
            .sort((a, b) => Math.abs(a.price - refPrice) - Math.abs(b.price - refPrice))
            .slice(0, count)
            .map(p => p.price);

        selectedHighs = allHighs
            .sort((a, b) => Math.abs(a.price - refPrice) - Math.abs(b.price - refPrice))
            .slice(0, count)
            .map(p => p.price);
    } else {
        // 基于时间选择最近的 count 个
        selectedLows = allLows.slice(-count).map(p => p.price);
        selectedHighs = allHighs.slice(-count).map(p => p.price);
    }

    // 最终返回时保持网格的标准排序：低点升序，高点降序（便于 GridContestant 内部再分配）
    selectedLows.sort((a, b) => a - b);
    selectedHighs.sort((a, b) => b - a);

    return { lows: selectedLows, highs: selectedHighs };
}
