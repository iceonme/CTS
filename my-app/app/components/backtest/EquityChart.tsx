"use client";

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, ColorType, LineSeries } from 'lightweight-charts';

interface EquityChartProps {
    data: {
        timestamp: number;
        equities: Record<string, number>;
        positions?: Record<string, { btc: number; usdt: number }>;
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
            const series = chart.addSeries(LineSeries, {
                color: c.color,
                lineWidth: 2,
                title: c.name,
                lastValueVisible: false,
                priceLineVisible: false,
            });
            
            // 为每个series设置独立的tooltip格式化
            series.applyOptions({
                priceFormat: {
                    type: 'price',
                    precision: 2,
                    minMove: 0.01,
                },
            });
            
            seriesMap[c.id] = series;
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

    // 添加全局tooltip，显示所有选手在鼠标位置的数据
    useEffect(() => {
        if (!chartRef.current || !chartContainerRef.current) return;
        
        const chart = chartRef.current;
        const container = chartContainerRef.current;

        // 创建tooltip元素
        const toolTip = document.createElement('div');
        toolTip.style.cssText = `
            position: absolute;
            display: none;
            padding: 8px 12px;
            box-sizing: border-box;
            font-size: 11px;
            z-index: 1000;
            pointer-events: none;
            border: 1px solid #374151;
            border-radius: 6px;
            background: rgba(17, 24, 39, 0.95);
            color: #e5e7eb;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
            max-width: 280px;
        `;
        container.appendChild(toolTip);

        const handleCrosshairMove = (param: any) => {
            if (
                !param.time ||
                !param.point ||
                param.point.x < 0 ||
                param.point.x > container.clientWidth ||
                param.point.y < 0 ||
                param.point.y > 400
            ) {
                toolTip.style.display = 'none';
                return;
            }

            const timestamp = (param.time as number) * 1000;
            // 找到最接近的数据点
            const dataPoint = data.reduce((closest, current) => {
                const closestDiff = Math.abs(closest.timestamp - timestamp);
                const currentDiff = Math.abs(current.timestamp - timestamp);
                return currentDiff < closestDiff ? current : closest;
            }, data[0]);

            if (!dataPoint) {
                toolTip.style.display = 'none';
                return;
            }

            const dateStr = new Date(dataPoint.timestamp).toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            let tooltipHtml = `<div style="font-weight: bold; margin-bottom: 6px; color: #9ca3af; border-bottom: 1px solid #374151; padding-bottom: 4px;">${dateStr}</div>`;
            
            contestants.forEach(c => {
                const equity = dataPoint.equities[c.id];
                const position = dataPoint.positions?.[c.id];
                if (equity !== undefined) {
                    const btc = position?.btc?.toFixed(4) || '0.0000';
                    const usdt = position?.usdt?.toFixed(2) || '0.00';
                    
                    tooltipHtml += `
                        <div style="margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${c.color}; flex-shrink: 0;"></div>
                            <div style="flex: 1;">
                                <div style="font-weight: 500; color: #e5e7eb;">${c.name}</div>
                                <div style="color: #9ca3af; font-size: 10px;">
                                    🪙 ${btc} BTC | 💵 $${usdt} USDT
                                </div>
                            </div>
                        </div>
                    `;
                }
            });

            toolTip.innerHTML = tooltipHtml;
            toolTip.style.display = 'block';
            
            // 计算tooltip位置，防止超出边界
            const tooltipRect = toolTip.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            let left = param.point.x + 15;
            let top = param.point.y + 15;
            
            if (left + 280 > containerRect.width) {
                left = param.point.x - 295;
            }
            if (top + tooltipRect.height > 400) {
                top = param.point.y - tooltipRect.height - 15;
            }
            
            toolTip.style.left = `${left}px`;
            toolTip.style.top = `${top}px`;
        };

        const handleMouseLeave = () => {
            toolTip.style.display = 'none';
        };

        chart.subscribeCrosshairMove(handleCrosshairMove);
        container.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            chart.unsubscribeCrosshairMove(handleCrosshairMove);
            container.removeEventListener('mouseleave', handleMouseLeave);
            if (toolTip.parentNode) {
                toolTip.parentNode.removeChild(toolTip);
            }
        };
    }, [data, contestants]);

    return <div ref={chartContainerRef} className="w-full h-full relative" />;
}
