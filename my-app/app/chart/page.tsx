'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createChart, CandlestickSeries, HistogramSeries, UTCTimestamp } from 'lightweight-charts';

interface KlineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const INTERVALS = [
  { label: '1分', value: '1m', seconds: 60, days: 7 },
  { label: '5分', value: '5m', seconds: 300, days: 30 },
  { label: '15分', value: '15m', seconds: 900, days: 90 },
  { label: '1时', value: '1h', seconds: 3600, days: 365 },
  { label: '4时', value: '4h', seconds: 14400, days: 365 },
  { label: '1日', value: '1d', seconds: 86400, days: 365 },
];

function aggregateKlines(data: KlineData[], intervalSeconds: number): KlineData[] {
  if (intervalSeconds === 60 || data.length === 0) return data;
  
  const aggregated: KlineData[] = [];
  let current: KlineData | null = null;
  
  for (const k of data) {
    const bucketTime = Math.floor(k.timestamp / 1000 / intervalSeconds) * intervalSeconds;
    
    if (!current || Math.floor(current.timestamp / 1000) !== bucketTime) {
      if (current) aggregated.push(current);
      current = { ...k, timestamp: bucketTime * 1000 };
    } else {
      current.high = Math.max(current.high, k.high);
      current.low = Math.min(current.low, k.low);
      current.close = k.close;
      current.volume += k.volume;
    }
  }
  if (current) aggregated.push(current);
  return aggregated;
}

function ChartContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [interval, setInterval] = useState(() => searchParams.get('interval') || '1m');
  
  // 当URL参数变化时更新interval
  useEffect(() => {
    const urlInterval = searchParams.get('interval');
    if (urlInterval && INTERVALS.some(i => i.value === urlInterval)) {
      setInterval(urlInterval);
    }
  }, [searchParams]);
  const [info, setInfo] = useState({ count: 0, agg: 0, start: '', end: '' });
  const [rawData, setRawData] = useState<KlineData[]>([]);

  // 加载数据
  const loadData = useCallback(async (intv: string) => {
    setLoading(true);
    try {
      const cfg = INTERVALS.find(i => i.value === intv)!;
      const end = new Date('2025-02-01T00:00:00Z');
      const start = new Date(end.getTime() - cfg.days * 24 * 60 * 60 * 1000);
      
      const res = await fetch(
        `/api/market/klines/?symbol=BTCUSDT&interval=1m&start=${start.toISOString()}&end=${end.toISOString()}&limit=50000`
      );
      const result = await res.json();
      
      if (result.success && result.data.length > 0) {
        setRawData(result.data);
        setInfo({
          count: result.data.length,
          agg: 0, // 将在aggregatedData计算后更新
          start: new Date(result.data[0].timestamp).toLocaleDateString('zh-CN'),
          end: new Date(result.data[result.data.length - 1].timestamp).toLocaleDateString('zh-CN'),
        });
      }
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadData('1m');
  }, [loadData]);

  // 聚合后的数据
  const aggregatedData = rawData.length > 0 
    ? aggregateKlines(rawData, INTERVALS.find(i => i.value === interval)!.seconds) 
    : [];

  // 渲染图表 - 当rawData或interval变化时
  useEffect(() => {
    if (!containerRef.current || aggregatedData.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#131722' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2b2b43' }, horzLines: { color: '#2b2b43' } },
      width: containerRef.current.clientWidth,
      height: 520,
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
    });

    const volumes = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' }, priceScaleId: '',
    });
    volumes.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const candleData = aggregatedData.map((d: KlineData) => ({
      time: Math.floor(d.timestamp / 1000) as UTCTimestamp,
      open: d.open, high: d.high, low: d.low, close: d.close,
    }));
    const volumeData = aggregatedData.map((d: KlineData) => ({
      time: Math.floor(d.timestamp / 1000) as UTCTimestamp,
      value: d.volume,
      color: d.close > d.open ? '#26a69a80' : '#ef535080',
    }));

    candles.setData(candleData);
    volumes.setData(volumeData);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth, height: 520 });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [aggregatedData, interval]);

  const current = INTERVALS.find(i => i.value === interval);

  const handleIntervalChange = (val: string) => {
    setInterval(val);
    // 更新URL但不刷新页面
    const url = new URL(window.location.href);
    url.searchParams.set('interval', val);
    window.history.replaceState({}, '', url);
    loadData(val);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">TradeMind 市场数据</h1>
          <p className="text-gray-400 text-sm">
            基于 Binance 1分钟 K线数据（2025年1-2月）
            <span className="ml-2 text-xs text-gray-500">- 数据库共 525,601 条记录</span>
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
          <div className="w-px h-6 bg-gray-700" />
          <button
            onClick={() => loadData(interval)}
            disabled={loading}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm"
          >
            {loading ? '加载中...' : '刷新'}
          </button>
          {(info.count > 0 || aggregatedData.length > 0) && (
            <div className="ml-auto text-xs text-gray-400">
              <span>显示: {info.start || '-'} ~ {info.end || '-'}</span>
              <span className="ml-3">{aggregatedData.length.toLocaleString()} 根{current?.label}K线</span>
            </div>
          )}
        </div>

        <div ref={containerRef} className="bg-gray-800 rounded-b-lg" style={{ height: '520px' }} />

        <div className="mt-4 bg-gray-800 rounded-lg p-4 text-sm text-gray-400">
          <h3 className="text-white font-medium mb-2">关于数据</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>数据库包含 2025年全年 BTCUSDT 1分钟K线（525,601条），存储在本地 DuckDB</li>
            <li>不同周期自动加载合适的时间范围：1分(7天)、5分(30天)、1时/日线(全年)</li>
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
