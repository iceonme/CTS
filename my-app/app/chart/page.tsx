'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createChart, CandlestickSeries, HistogramSeries, UTCTimestamp, ISeriesApi, IChartApi } from 'lightweight-charts';

interface KlineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const INTERVALS = [
  { label: '1分', value: '1m' },
  { label: '5分', value: '5m' },
  { label: '15分', value: '15m' },
  { label: '1时', value: '1h' },
  { label: '4时', value: '4h' },
  { label: '1日', value: '1d' },
];

const VISIBLE_BARS = 150;
const LOAD_MORE_BARS = 200;

function toChartData(data: KlineData[]) {
  return data.map(d => ({
    time: Math.floor(d.timestamp / 1000) as UTCTimestamp,
    open: d.open, high: d.high, low: d.low, close: d.close,
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
  
  const searchParams = useSearchParams();
  const [interval, setInterval] = useState(() => searchParams.get('interval') || '1d');
  const [data, setData] = useState<KlineData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // 更新图表
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (data.length === 0) return;

    candleSeriesRef.current.setData(toChartData(data) as any);
    volumeSeriesRef.current.setData(toVolumeData(data) as any);
  }, [data]);

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
    });

    const volumes = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' }, priceScaleId: '',
    });
    volumes.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    chartRef.current = chart;
    candleSeriesRef.current = candles;
    volumeSeriesRef.current = volumes;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth, height: 520 });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [interval]);

  // 加载最新数据
  const loadLatest = async (intv: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/market/klines/?symbol=BTCUSDT&interval=${intv}&limit=${VISIBLE_BARS}`);
      const result = await res.json();
      
      if (result.success && result.data.length > 0) {
        setData(result.data);
        setHasMore(result.data.length >= VISIBLE_BARS);
        
        setTimeout(() => {
          chartRef.current?.timeScale().scrollToRealTime();
        }, 100);
      }
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  };

  // 加载历史数据
  const loadHistory = async () => {
    if (loading || !hasMore || data.length === 0) {
      console.log('Skip loadHistory:', { loading, hasMore, dataLength: data.length });
      return;
    }
    
    setLoading(true);
    const oldestTimestamp = data[0].timestamp;
    
    try {
      console.log('Loading history before:', oldestTimestamp);
      const res = await fetch(
        `/api/market/klines/?symbol=BTCUSDT&interval=${interval}&before=${oldestTimestamp}&limit=${LOAD_MORE_BARS}`
      );
      const result = await res.json();
      
      console.log('History response:', result.meta);
      
      if (result.success && result.data.length > 0) {
        const newData = result.data;
        const combined = [...newData, ...data];
        setData(combined);
        
        if (newData.length < LOAD_MORE_BARS) {
          setHasMore(false);
        }
        console.log('Added', newData.length, 'bars, total:', combined.length);
      } else {
        setHasMore(false);
        console.log('No more data');
      }
    } catch (e) {
      console.error('Load history error:', e);
    } finally {
      setLoading(false);
    }
  };

  // 切换周期
  const handleIntervalChange = (val: string) => {
    setInterval(val);
    setData([]);
    setHasMore(true);
    
    const url = new URL(window.location.href);
    url.searchParams.set('interval', val);
    window.history.replaceState({}, '', url);
    
    loadLatest(val);
  };

  // 初始加载
  useEffect(() => {
    loadLatest(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = INTERVALS.find(i => i.value === interval);
  const oldestDate = data.length > 0 ? new Date(data[0].timestamp).toLocaleDateString('zh-CN') : '-';
  const newestDate = data.length > 0 ? new Date(data[data.length - 1].timestamp).toLocaleDateString('zh-CN') : '-';

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">TradeMind 市场数据</h1>
          <p className="text-gray-400 text-sm">基于 Binance K线数据（2025年全年）</p>
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
          
          {hasMore ? (
            <button
              onClick={loadHistory}
              disabled={loading}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm flex items-center gap-1"
            >
              <span>←</span>
              <span>{loading ? '加载中...' : '加载历史'}</span>
            </button>
          ) : (
            <span className="text-xs text-gray-500">已加载全部</span>
          )}
          
          {data.length > 0 && (
            <div className="ml-auto text-xs text-gray-400">
              <span>{oldestDate} → {newestDate}</span>
              <span className="ml-2">({data.length} 根{current?.label})</span>
            </div>
          )}
        </div>

        <div ref={containerRef} className="bg-gray-800 rounded-b-lg" style={{ height: '520px' }} />

        <div className="mt-4 bg-gray-800 rounded-lg p-4 text-sm text-gray-400">
          <h3 className="text-white font-medium mb-2">使用说明</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>图表默认显示最新的 {VISIBLE_BARS} 根K线</li>
            <li>点击"← 加载历史"按钮加载更早的数据（每次 {LOAD_MORE_BARS} 根）</li>
            <li>可多次点击加载，直到2025年1月1日</li>
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
