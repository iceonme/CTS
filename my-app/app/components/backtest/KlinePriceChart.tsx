"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import {
    createChart,
    IChartApi,
    ISeriesApi,
    ColorType,
    CandlestickSeries,
    CandlestickData,
    SeriesMarker,
    Time,
    createSeriesMarkers,
} from 'lightweight-charts';

interface TradeItem {
    timestamp: number;
    side: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    totalUsdt?: number;
    contestantId?: string;
    contestantName?: string;
    contestantColor?: string;
}

interface KlinePriceChartProps {
    symbol: string;
    startTime: string;   // '2025-01-01'
    endTime: string;
    currentTimestamp: number | null;
    trades: TradeItem[];
    contestants: { id: string; name: string; color: string }[];
    selectedContestantId: string | null;
    loading: boolean;
}

interface KlineDataPoint {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// 颜色工具：调整透明度
function colorWithAlpha(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 颜色工具：变亮（买入标记用）
function lightenColor(hex: string, factor: number = 0.3): string {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + 255 * factor);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + 255 * factor);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + 255 * factor);
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// 颜色工具：变暗（卖出标记用）
function darkenColor(hex: string, factor: number = 0.3): string {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) * (1 - factor));
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) * (1 - factor));
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) * (1 - factor));
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

export default function KlinePriceChart({
    symbol,
    startTime,
    endTime,
    currentTimestamp,
    trades,
    contestants,
    selectedContestantId,
    loading,
}: KlinePriceChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const pastSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const futureSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const progressLineDivRef = useRef<HTMLDivElement | null>(null);
    const markersRef = useRef<any>(null);

    const [interval, setInterval_] = useState<'1m' | '5m' | '15m' | '1h' | '1d'>('15m');
    const [allKlineData, setAllKlineData] = useState<KlineDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // 加载 K 线数据
    const fetchKlineData = useCallback(async (klineInterval: string) => {
        setIsLoading(true);
        try {
            const startMs = new Date(startTime).getTime();
            const endMs = new Date(endTime).getTime();
            const rangeDays = (endMs - startMs) / (24 * 60 * 60 * 1000);
            // 根据 interval 和日期范围动态计算所需条数
            const intervalsPerDay: Record<string, number> = { '1m': 1440, '5m': 288, '15m': 96, '1h': 24, '1d': 1 };
            const neededBars = Math.ceil(rangeDays * (intervalsPerDay[klineInterval] || 24)) + 50;
            const limit = Math.min(neededBars, 50000);
            const url = `/api/market/klines?symbol=${symbol}&interval=${klineInterval}&start=${startMs}&end=${endMs}&limit=${limit}`;
            const res = await fetch(url);
            const json = await res.json();
            if (json.success && json.data) {
                setAllKlineData(json.data);
                // 数据更新后，标记下一帧需要重新对焦（因为interval刷新了视野深度）
                hasInitialFitRef.current = false;
            }
        } catch (err) {
            console.error('[KlinePriceChart] Failed to fetch kline data:', err);
        } finally {
            setIsLoading(false);
        }
    }, [symbol, startTime, endTime]);

    // 初始加载 + interval 切换时重新加载
    useEffect(() => {
        fetchKlineData(interval);
    }, [interval, fetchKlineData]);

    // 创建图表（仅初始化一次）
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#9ca3af',
            },
            grid: {
                vertLines: { color: '#1f2937' },
                horzLines: { color: '#1f2937' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 300,
            timeScale: {
                timeVisible: true,
                borderColor: '#374151',
                shiftVisibleRangeOnNewBar: false, // 防止新数据进场时视野自动移动
            },
            rightPriceScale: {
                borderColor: '#374151',
            },
            crosshair: {
                horzLine: { color: '#4b5563', labelBackgroundColor: '#374151' },
                vertLine: { color: '#4b5563', labelBackgroundColor: '#374151' },
            },
        });

        chartRef.current = chart;

        // 已过时间 K 线（正常颜色）
        const pastSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
            borderVisible: false,
            lastValueVisible: true,
            priceLineVisible: false,
        });
        pastSeriesRef.current = pastSeries;

        // 未来时间 K 线（半透明灰度）
        const futureSeries = chart.addSeries(CandlestickSeries, {
            upColor: 'rgba(100, 116, 139, 0.3)',
            downColor: 'rgba(100, 116, 139, 0.2)',
            wickUpColor: 'rgba(100, 116, 139, 0.3)',
            wickDownColor: 'rgba(100, 116, 139, 0.2)',
            borderVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
        });
        futureSeriesRef.current = futureSeries;

        // 进度指示线（CSS overlay）
        // 不再使用 LineSeries，改为 DOM div

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            chartRef.current = null;
        };
    }, []);

    // 首次加载标记
    const hasInitialFitRef = useRef(false);

    // 更新 K 线数据和分割
    useEffect(() => {
        if (!pastSeriesRef.current || !futureSeriesRef.current || allKlineData.length === 0) return;

        const splitTimestamp = currentTimestamp || 0;

        const pastData: CandlestickData[] = [];
        const futureData: CandlestickData[] = [];

        for (const kline of allKlineData) {
            const cd: CandlestickData = {
                time: (kline.timestamp / 1000) as Time,
                open: kline.open,
                high: kline.high,
                low: kline.low,
                close: kline.close,
            };

            if (splitTimestamp > 0 && kline.timestamp <= splitTimestamp) {
                pastData.push(cd);
            } else if (splitTimestamp > 0) {
                futureData.push(cd);
            } else {
                // 回测未开始时，全部显示为未来（灰色）
                futureData.push(cd);
            }
        }

        pastSeriesRef.current.setData(pastData);
        futureSeriesRef.current.setData(futureData);

        // 进度指示线（CSS overlay）：使用 timeToCoordinate 定位
        if (splitTimestamp > 0 && chartRef.current && progressLineDivRef.current) {
            const timeInSec = Math.floor(splitTimestamp / 1000) as unknown as Time;
            const x = chartRef.current.timeScale().timeToCoordinate(timeInSec);
            if (x !== null && x >= 0) {
                progressLineDivRef.current.style.left = `${x}px`;
                progressLineDivRef.current.style.display = 'block';
            } else {
                progressLineDivRef.current.style.display = 'none';
            }
        } else if (progressLineDivRef.current) {
            progressLineDivRef.current.style.display = 'none';
        }
    }, [allKlineData, currentTimestamp, interval]);

    // 独立控制初始对焦，避免受进度更新干扰
    useEffect(() => {
        // isLoading 为 true 时不执行，确保数据加载完成后再对焦
        if (!chartRef.current || allKlineData.length === 0 || hasInitialFitRef.current || isLoading) return;

        const timeScale = chartRef.current.timeScale();

        // 确保在数据渲染且系列更新后执行
        const timer = setTimeout(() => {
            if (!chartRef.current || !hasInitialFitRef) return;

            // 锁定在最开始的位置
            timeScale.scrollToPosition(0, false);
            timeScale.setVisibleLogicalRange({
                from: 0,
                to: Math.min(allKlineData.length, 150),
            });
            hasInitialFitRef.current = true;
        }, 150);

        return () => clearTimeout(timer);
    }, [allKlineData, interval, isLoading]);

    // 添加买卖标记
    useEffect(() => {
        if (!pastSeriesRef.current || allKlineData.length === 0) return;

        // 清除旧标记
        if (markersRef.current) {
            markersRef.current.detach();
            markersRef.current = null;
        }

        // 筛选交易
        const filteredTrades = selectedContestantId
            ? trades.filter(t => t.contestantId === selectedContestantId)
            : trades;

        if (filteredTrades.length === 0) return;

        // 把交易映射到最近的 K 线时间
        const markers: SeriesMarker<Time>[] = filteredTrades
            .map(trade => {
                // 找到交易对应的 K 线时间戳
                const kline = findNearestKline(allKlineData, trade.timestamp, interval);
                if (!kline) return null;

                const color = trade.contestantColor || '#9ca3af';

                return {
                    time: (kline.timestamp / 1000) as Time,
                    position: trade.side === 'BUY' ? 'belowBar' as const : 'aboveBar' as const,
                    color: trade.side === 'BUY' ? lightenColor(color, 0.2) : darkenColor(color, 0.2),
                    shape: trade.side === 'BUY' ? 'arrowUp' as const : 'arrowDown' as const,
                    text: `${trade.side === 'BUY' ? 'B' : 'S'}`,
                };
            })
            .filter(Boolean) as SeriesMarker<Time>[];

        // markers 需要按时间排序
        markers.sort((a, b) => (a.time as number) - (b.time as number));

        // 使用 v5 API 创建标记
        markersRef.current = createSeriesMarkers(pastSeriesRef.current, markers);
    }, [trades, allKlineData, selectedContestantId, interval]);

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 relative">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    📊 {symbol} K 线图
                    {(isLoading || loading) && (
                        <span className="text-xs font-normal text-blue-400 animate-pulse">(加载中...)</span>
                    )}
                </h2>
                <div className="flex items-center gap-1">
                    {(['1m', '5m', '15m', '1h', '1d'] as const).map(iv => (
                        <button
                            key={iv}
                            onClick={() => setInterval_(iv)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${interval === iv
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                                }`}
                        >
                            {iv === '1m' ? '1m' : iv === '5m' ? '5m' : iv === '15m' ? '15m' : iv === '1h' ? '1h' : '1d'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative">
                <div ref={chartContainerRef} className="w-full" style={{ height: 300 }} />
                {/* 进度指示线 CSS overlay */}
                <div
                    ref={progressLineDivRef}
                    className="pointer-events-none"
                    style={{
                        display: 'none',
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        background: 'repeating-linear-gradient(to bottom, #3b82f6 0px, #3b82f6 4px, transparent 4px, transparent 8px)',
                        zIndex: 10,
                    }}
                />
            </div>

            {allKlineData.length === 0 && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-600 pointer-events-none">
                    <div className="text-center">
                        <div className="text-3xl mb-2">📉</div>
                        <p className="text-sm">等待加载 K 线数据...</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// 辅助函数
function getIntervalMs(interval: string): number {
    switch (interval) {
        case '1m': return 1 * 60 * 1000;
        case '5m': return 5 * 60 * 1000;
        case '15m': return 15 * 60 * 1000;
        case '1h': return 60 * 60 * 1000;
        case '4h': return 4 * 60 * 60 * 1000;
        case '1d': return 24 * 60 * 60 * 1000;
        default: return 60 * 60 * 1000;
    }
}

function findNearestKline(klines: KlineDataPoint[], timestamp: number, interval: string): KlineDataPoint | null {
    const intervalMs = getIntervalMs(interval);
    // 找到 timestamp 对应的 K 线桶
    let best: KlineDataPoint | null = null;
    let bestDist = Infinity;
    for (const k of klines) {
        const dist = Math.abs(k.timestamp - timestamp);
        if (dist < bestDist) {
            bestDist = dist;
            best = k;
        }
        // K 线桶包含该时间
        if (k.timestamp <= timestamp && k.timestamp + intervalMs > timestamp) {
            return k;
        }
    }
    return best;
}
