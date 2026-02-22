/**
 * K线聚合器 (Kline Aggregator)
 * 
 * 将低周期K线（如1分钟）聚合为高周期K线（如15分钟、1小时、4小时、日线等）。
 * 标准OHLCV聚合规则：
 * - Open: 第一根K线的 open
 * - High: 所有K线的 high 最大值
 * - Low: 所有K线的 low 最小值
 * - Close: 最后一根K线的 close
 * - Volume: 所有K线的 volume 之和
 * 
 * 使用示例：
 *   import { to15m, to1h, to4h, to1d, aggregateKlines } from './kline-aggregator';
 *   const klines15m = to15m(klines1m);
 *   const klines1h  = to1h(klines1m);
 *   const klines4h  = to4h(klines1m);
 *   const klinesDay = to1d(klines1m);
 *   const custom    = aggregateKlines(klines1m, 30); // 30分钟
 */

import { KlineData } from '../data/market-db';

// ============================================
// 标准周期常量
// ============================================

/** 支持的聚合周期 */
export type AggregateInterval = '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d';

/** 周期对应的分钟数 */
export const INTERVAL_MINUTES: Record<AggregateInterval, number> = {
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60,
    '2h': 120,
    '4h': 240,
    '6h': 360,
    '12h': 720,
    '1d': 1440,
};

// ============================================
// 核心聚合函数
// ============================================

/**
 * 将1分钟K线聚合为指定周期的K线
 * @param klines 1分钟K线数组（需按时间升序排列）
 * @param intervalMinutes 目标周期（分钟），如 15、60、240
 * @returns 聚合后的K线数组（按时间升序排列）
 */
export function aggregateKlines(klines: KlineData[], intervalMinutes: number): KlineData[] {
    if (klines.length === 0) return [];
    if (intervalMinutes <= 1) return klines;

    const intervalMs = intervalMinutes * 60 * 1000;
    const aggregated: KlineData[] = [];

    let bucketStart = Math.floor(klines[0].timestamp / intervalMs) * intervalMs;
    let bucket: KlineData[] = [];

    for (const kline of klines) {
        const klineBucketStart = Math.floor(kline.timestamp / intervalMs) * intervalMs;

        if (klineBucketStart !== bucketStart && bucket.length > 0) {
            // 完成当前桶，输出聚合K线
            aggregated.push(mergeBucket(bucket, bucketStart, intervalMinutes));
            bucket = [];
            bucketStart = klineBucketStart;
        }

        bucket.push(kline);
    }

    // 处理最后一个桶
    if (bucket.length > 0) {
        aggregated.push(mergeBucket(bucket, bucketStart, intervalMinutes));
    }

    return aggregated;
}

/**
 * 使用标准周期字符串聚合K线
 * @param klines 1分钟K线数组（需按时间升序排列）
 * @param interval 目标周期，如 '15m', '1h', '4h', '1d'
 * @returns 聚合后的K线数组
 */
export function aggregateByInterval(klines: KlineData[], interval: AggregateInterval): KlineData[] {
    const minutes = INTERVAL_MINUTES[interval];
    if (!minutes) {
        throw new Error(`不支持的聚合周期: ${interval}，可选: ${Object.keys(INTERVAL_MINUTES).join(', ')}`);
    }
    return aggregateKlines(klines, minutes);
}

// ============================================
// 便捷函数
// ============================================

/** 1分钟 → 15分钟 K线 */
export function to15m(klines: KlineData[]): KlineData[] {
    return aggregateKlines(klines, 15);
}

/** 1分钟 → 1小时 K线 */
export function to1h(klines: KlineData[]): KlineData[] {
    return aggregateKlines(klines, 60);
}

/** 1分钟 → 4小时 K线 */
export function to4h(klines: KlineData[]): KlineData[] {
    return aggregateKlines(klines, 240);
}

/** 1分钟 → 日线 K线 */
export function to1d(klines: KlineData[]): KlineData[] {
    return aggregateKlines(klines, 1440);
}

// ============================================
// 内部工具
// ============================================

/**
 * 将一组K线合并为一根标准 OHLCV K线
 */
function mergeBucket(bucket: KlineData[], timestamp: number, intervalMinutes: number): KlineData {
    const first = bucket[0];
    const last = bucket[bucket.length - 1];

    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    let quoteVolume = 0;
    let takerBuyBaseVolume = 0;
    let tradeCount = 0;

    for (const k of bucket) {
        if (k.high > high) high = k.high;
        if (k.low < low) low = k.low;
        volume += k.volume || 0;
        quoteVolume += k.quoteVolume || 0;
        takerBuyBaseVolume += k.takerBuyBaseVolume || 0;
        tradeCount += k.tradeCount || 0;
    }

    // 根据分钟数推断 interval 标签
    const intervalLabel = Object.entries(INTERVAL_MINUTES).find(([, min]) => min === intervalMinutes)?.[0] || `${intervalMinutes}m`;

    return {
        symbol: first.symbol,
        interval: intervalLabel,
        timestamp: timestamp,
        open: first.open,
        high,
        low,
        close: last.close,
        volume,
        quoteVolume,
        takerBuyBaseVolume,
        tradeCount,
    };
}
