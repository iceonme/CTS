"use client";

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, ColorType, LineSeries } from 'lightweight-charts';

interface EquityChartProps {
    data: {
        timestamp: number;
        equities: Record<string, number>;
    }[];
    contestants: { id: string; name: string; color: string }[];
}

export default function EquityChart({ data, contestants }: EquityChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<Record<string, ISeriesApi<"Line">>>({});

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#9ca3af',
            },
            grid: {
                vertLines: { color: '#374151' },
                horzLines: { color: '#374151' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 400,
            timeScale: {
                timeVisible: true,
                borderColor: '#374151',
            },
        });

        chartRef.current = chart;

        // 为每个参赛者创建一条线
        const seriesMap: Record<string, ISeriesApi<"Line">> = {};
        contestants.forEach(c => {
            seriesMap[c.id] = chart.addSeries(LineSeries, {
                color: c.color,
                lineWidth: 2,
                title: c.name,
            });
        });
        seriesRef.current = seriesMap;

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [contestants]);

    useEffect(() => {
        if (!chartRef.current || data.length === 0) return;

        contestants.forEach(c => {
            const lineData: LineData[] = data.map(d => ({
                time: (d.timestamp / 1000) as any,
                value: d.equities[c.id] || 10000,
            }));
            seriesRef.current[c.id].setData(lineData);
        });

        chartRef.current.timeScale().fitContent();
    }, [data, contestants]);

    return <div ref={chartContainerRef} className="w-full h-full" />;
}
