'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createChart, CandlestickSeries, HistogramSeries, UTCTimestamp, ISeriesApi, IChartApi, LogicalRange } from 'lightweight-charts';

interface KlineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface LoadedRange {
  start: number; // 已加载的最早时间戳
  end: number;   // 已加载的最晚时间戳
}

const INTERVALS = [
  { label: '1分', value: '1m', seconds: 60 },
  { label: '5分', value: '5m', seconds: 300 },
  { label: '15分', value: '15m', seconds: 900 },
  { label: '1时', value: '1h', seconds: 3600 },
  { label: '4时', value: '4h', seconds: 14400 },
  { label: '1日', value: '1d', seconds: 86400 },
];

const VISIBLE_BARS = 150; // 初始显示的K线数量
const LOAD_MORE_BARS = 200; // 每次加载的K线数量
const LOAD_THRESHOLD = 20; // 距离边界多少根K线时触发加载

function toChartData(data: KlineData[]) {
  return data.map(d => ({
    time: Math.floor(d.timestamp / 1000) as UTCTimestamp,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
  }));
}

function toVolumeData(data: KlineData[]) {
  return data.map(d => ({
    time: Math.floor(d.timestamp / 1000) as UTCTimestamp,
    value: d.volume,
    color: d.close > d.open ? '#26a69a80' : '#ef535080',
  }));
}

function ChartContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const allDataRef = useRef<Map<number, KlineData>>(new Map());
  const loadedRangeRef = useRef<LoadedRange | null>(null);
  const isLoadingRef = useRef(false);
  
  const searchParams = useSearchParams();
  const [interval, setInterval] = useState(() => searchParams.get('interval') || '1m');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState({ total: 0, start: '', end: '' });

  // 加载数据（加载更早的历史）
  const loadHistory = useCallback(async (beforeTimestamp: number, intv: string) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    
    try {
      // 计算要加载的时间范围
      const cfg = INTERVALS.find(i => i.value === intv)!;
      const endTime = beforeTimestamp;
      const startTime = endTime - (cfg.seconds * LOAD_MORE_BARS * 1000);
      
      const res = await fetch(
        `/api/market/klines?symbol=BTCUSDT&interval=${intv}` +
        `&end=${new Date(endTime).toISOString()}` +
        `&limit=${LOAD_MORE_BARS}`
      );
      const result = await res.json();
      
      if (result.success && result.data.length > 0) {
        const newData: KlineData[] = result.data;
        
        // 合并到全局数据
        newData.forEach(d => {
          allDataRef.current.set(d.timestamp, d);
        });
        
        // 更新已加载范围
        const timestamps = Array.from(allDataRef.current.keys()).sort((a, b) => a - b);
        loadedRangeRef.current = {
          start: timestamps[0],
          end: timestamps[timestamps.length - 1]
        };
        
        // 更新图表
        const sortedData = timestamps.map(t => allDataRef.current.get(t)!);
        candleSeriesRef.current?.setData(toChartData(sortedData) as any);
        volumeSeriesRef.current?.setData(toVolumeData(sortedData) as any);
        
        setInfo({
          total: sortedData.length,
          start: new Date(sortedData[0].timestamp).toLocaleDateString('zh-CN'),
          end: new Date(sortedData[sortedData.length - 1].timestamp).toLocaleDateString('zh-CN'),
        });
        
        console.log(`加载了 ${newData.length} 根历史K线，总共 ${sortedData.length} 根`);
      }
    } catch (e) {
      console.error('加载历史数据失败:', e);
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, []);

  // 加载最新数据（初始加载）
  const loadLatest = useCallback(async (intv: string) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    
    try {
      const res = await fetch(
        `/api/market/klines?symbol=BTCUSDT&interval=${intv}` +
        `&limit=${VISIBLE_BARS}`
      );
      const result = await res.json();
      
      if (result.success && result.data.length > 0) {
        const data: KlineData[] = result.data;
        
        // 重置数据
        allDataRef.current.clear();
        data.forEach(d => allDataRef.current.set(d.timestamp, d));
        
        loadedRangeRef.current = {
          start: data[0].timestamp,
          end: data[data.length - 1].timestamp
        };
        
        // 设置图表数据
        candleSeriesRef.current?.setData(toChartData(data) as any);
        volumeSeriesRef.current?.setData(toVolumeData(data) as any);
        
        // 移动到最新数据
        chartRef.current?.timeScale().scrollToRealTime();
        
        setInfo({
          total: data.length,
          start: new Date(data[0].timestamp).toLocaleDateString('zh-CN'),
          end: new Date(data[data.length - 1].timestamp).toLocaleDateString('zh-CN'),
        });
        
        console.log(`初始加载 ${data.length} 根K线`);
      }
    } catch (e) {
      console.error('加载最新数据失败:', e);
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, []);

  // 处理时间轴变化
  const handleVisibleRangeChange = useCallback((range: LogicalRange | null) => {
    if (!range || !loadedRangeRef.current) return;
    
    // 如果向左拖动（查看历史），且接近左边界，加载更多
    if (range.from < LOAD_THRESHOLD) {
      const currentStart = loadedRangeRef.current.start;
      loadHistory(currentStart, interval);
    }
  }, [interval, loadHistory]);

  // 初始化图表
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#131722' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2b2b43' }, horzLines: { color: '#2b2b43' } },
      width: containerRef.current.clientWidth,
      height: 520,
      timeScale: {
        timeVisible: interval === '1m' || interval === '5m' || interval === '15m',
        secondsVisible: false,
      },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
    });

    const volumes = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' }, priceScaleId: '',
    });
    volumes.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    chartRef.current = chart;
    candleSeriesRef.current = candles;
    volumeSeriesRef.current = volumes;

    // 监听可见范围变化
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
          width: containerRef.current.clientWidth, 
          height: 520 
        });
      }
    };
    window.addEventListener('resize', handleResize);

    // 初始加载
    setTimeout(() => loadLatest(interval), 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [interval, loadLatest, handleVisibleRangeChange]);

  // 切换周期
  const handleIntervalChange = (val: string) => {
    setInterval(val);
    allDataRef.current.clear();
    loadedRangeRef.current = null;
    
    // 更新URL
    const url = new URL(window.location.href);
    url.searchParams.set('interval', val);
    window.history.replaceState({}, '', url);
    
    // 重新加载
    loadLatest(val);
  };

  const current = INTERVALS.find(i => i.value === interval);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">TradeMind 市场数据</h1>
          <p className="text-gray-400 text-sm">
            基于 Binance K线数据
            <span className="ml-2 text-xs text-gray-500">
              拖动时间轴加载更多历史数据
            </span>
          </p>
        </div>

        <div className="bg-gray-800 rounded-t-lg p-3 flex flex-wrap items-center gap-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">BTC/USDT</span>
            <span className="text-xs text-gray-400">现货</span>
          </div>
          <div className="w-px h-6 bg-gray-700" />
          <div className="flex items-center gap-1">
            {INTERVALS.map((i) => (
              <button
                key={i.value}
                onClick={() => handleIntervalChange(i.value)}
                disabled={loading}
                className={`px-3 py-1.5 text-sm rounded transition-colors disabled:opacity-50 ${
                  interval === i.value ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                {i.label}
              </button>
            ))}
          </div>
          {loading && (
            <span className="text-xs text-blue-400 animate-pulse">加载中...</span>
          )}
          {info.total > 0 && (
            <div className="ml-auto text-xs text-gray-400">
              <span>已加载: {info.start} ~ {info.end}</span>
              <span className="ml-3">{info.total.toLocaleString()} 根{current?.label}K线</span>
            </div>
          )}
        </div>

        <div ref={containerRef} className="bg-gray-800 rounded-b-lg" style={{ height: '520px' }} />

        <div className="mt-4 bg-gray-800 rounded-lg p-4 text-sm text-gray-400">
          <h3 className="text-white font-medium mb-2">使用说明</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>图表默认显示最近的 {VISIBLE_BARS} 根K线</li>
            <li>向左拖动时间轴可加载更多历史数据</li>
            <li>切换周期时会重新加载对应的数据</li>
            <li>数据库包含 2025年全年 BTCUSDT 1分钟K线（525,601条）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function ChartPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 text-white p-4">加载中...</div>}>
      <ChartContent />
    </Suspense>
  );
}
