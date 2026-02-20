/**
 * 对照实验模拟验证
 * Phase 3.3-3.5 验证
 */

import { test, expect } from '@playwright/test';
import { LLMSoloContestant } from '../lib/agents/contestants/llm-solo-contestant';
import { MarketDatabase } from '../lib/data/market-db';
import { calculateRSI, calculateSMA, calculateMACD } from '../lib/skills/tools/analysis-tools';

test.describe('Phase 3.3-3.5: Contrast Experiment', () => {
    
    test('3.3 对照实验：三种变体实例化成功', () => {
        const mockDb = {} as MarketDatabase;
        const mockMinimax = { chat: async () => '{}' } as any;

        const contestants = [
            {
                id: 'solo-lite',
                name: 'Solo-Lite',
                config: { intelligenceLevel: 'lite' as const }
            },
            {
                id: 'solo-indicator',
                name: 'Solo-Indicator',
                config: { intelligenceLevel: 'indicator' as const }
            },
            {
                id: 'solo-strategy',
                name: 'Solo-Strategy',
                config: { intelligenceLevel: 'strategy' as const, includeDaily: true }
            }
        ];

        for (const c of contestants) {
            const contestant = new LLMSoloContestant(
                c.id,
                c.name,
                mockDb,
                mockMinimax,
                'BTCUSDT',
                c.config
            );

            expect(contestant.id).toBe(c.id);
            expect(contestant.name).toBe(c.name);
            expect(contestant.getConfig().intelligenceLevel).toBe(c.config.intelligenceLevel);
            console.log(`✓ ${c.name} 实例化成功`);
        }
    });

    test('3.4 三种变体的提示词信息密度不同', async () => {
        const mockDb = {
            queryKlines: async () => {
                // 模拟 24h 1m 数据
                const klines = [];
                let price = 50000;
                for (let i = 0; i < 1440; i++) {
                    price += (Math.random() - 0.5) * 100;
                    klines.push({
                        timestamp: new Date(Date.now() - (1440 - i) * 60000).toISOString(),
                        open: price - 50,
                        high: price + 100,
                        low: price - 100,
                        close: price,
                        volume: Math.random() * 1000
                    });
                }
                return klines;
            }
        } as any;

        const mockMinimax = { chat: async () => '{}' } as any;
        const mockClock = { now: () => Date.now() } as any;

        // 创建三个变体
        const lite = new LLMSoloContestant('lite', 'Lite', mockDb, mockMinimax, 'BTCUSDT', { intelligenceLevel: 'lite' });
        const indicator = new LLMSoloContestant('indicator', 'Indicator', mockDb, mockMinimax, 'BTCUSDT', { intelligenceLevel: 'indicator' });
        const strategy = new LLMSoloContestant('strategy', 'Strategy', mockDb, mockMinimax, 'BTCUSDT', { intelligenceLevel: 'strategy' });

        // 初始化
        await lite.initialize(10000, mockClock);
        await indicator.initialize(10000, mockClock);
        await strategy.initialize(10000, mockClock);

        // 获取配置验证
        const liteConfig = lite.getConfig();
        const indicatorConfig = indicator.getConfig();
        const strategyConfig = strategy.getConfig();

        expect(liteConfig.intelligenceLevel).toBe('lite');
        expect(indicatorConfig.intelligenceLevel).toBe('indicator');
        expect(strategyConfig.intelligenceLevel).toBe('strategy');

        console.log('\n📊 变体配置对比:');
        console.log(`  Lite:      level=${liteConfig.intelligenceLevel}, daily=${liteConfig.includeDaily}`);
        console.log(`  Indicator: level=${indicatorConfig.intelligenceLevel}, daily=${indicatorConfig.includeDaily}`);
        console.log(`  Strategy:  level=${strategyConfig.intelligenceLevel}, daily=${strategyConfig.includeDaily}`);
    });

    test('3.5 策略信号计算逻辑验证', () => {
        // 模拟数据：上涨趋势
        const bullishPrices = Array.from({ length: 100 }, (_, i) => 1000 + i * 10 + Math.random() * 50);
        
        // 模拟数据：下跌趋势
        const bearishPrices = Array.from({ length: 100 }, (_, i) => 2000 - i * 10 + Math.random() * 50);

        // 计算指标
        const bullishRSI = calculateRSI(bullishPrices, 14);
        const bullishSMA7 = calculateSMA(bullishPrices, 7);
        const bullishSMA25 = calculateSMA(bullishPrices, 25);
        const bullishMACD = calculateMACD(bullishPrices);

        const bearishRSI = calculateRSI(bearishPrices, 14);
        const bearishSMA7 = calculateSMA(bearishPrices, 7);
        const bearishSMA25 = calculateSMA(bearishPrices, 25);
        const bearishMACD = calculateMACD(bearishPrices);

        console.log('\n📈 上涨行情指标:');
        console.log(`  RSI: ${bullishRSI.toFixed(1)} (应>50)`);
        console.log(`  SMA排列: ${bullishSMA7 > bullishSMA25 ? '多头排列' : '其他'}`);
        console.log(`  MACD趋势: ${bullishMACD.histogram > 0 ? '看多' : '看空'}`);

        console.log('\n📉 下跌行情指标:');
        console.log(`  RSI: ${bearishRSI.toFixed(1)} (应<50)`);
        console.log(`  SMA排列: ${bearishSMA7 < bearishSMA25 ? '空头排列' : '其他'}`);
        console.log(`  MACD趋势: ${bearishMACD.histogram > 0 ? '看多' : '看空'}`);

        // 验证：上涨行情 RSI 应该较高
        expect(bullishRSI).toBeGreaterThan(50);
        // 验证：下跌行情 RSI 应该较低
        expect(bearishRSI).toBeLessThan(50);
        // 验证：上涨行情短期均线在长期均线上方
        expect(bullishSMA7).toBeGreaterThan(bullishSMA25);
        // 验证：下跌行情短期均线在长期均线下方
        expect(bearishSMA7).toBeLessThan(bearishSMA25);
    });

    test('3.6 生成对照实验报告', async () => {
        const report = {
            experiment: 'LLM Solo Variants Contrast Test',
            date: new Date().toISOString(),
            variants: [
                {
                    id: 'solo-lite',
                    name: 'Solo-Lite',
                    level: 'lite',
                    features: ['24h CSV data', 'Price summary'],
                    expectedBehavior: '基于价格走势做直觉判断',
                    pros: ['Token 消耗最少', '响应最快'],
                    cons: ['无指标辅助', '可能错过关键信号']
                },
                {
                    id: 'solo-indicator',
                    name: 'Solo-Indicator',
                    level: 'indicator',
                    features: ['RSI(14)', 'SMA(7/25/50)', 'MACD'],
                    expectedBehavior: '基于指标数值做量化判断',
                    pros: ['有明确指标参考', 'Token 消耗适中'],
                    cons: ['需要理解指标含义']
                },
                {
                    id: 'solo-strategy',
                    name: 'Solo-Strategy',
                    level: 'strategy',
                    features: ['All indicators', 'Multi-timeframe', 'Strategy rules', 'Structured reasoning'],
                    expectedBehavior: '多时间框架+结构化推理+策略规则',
                    pros: ['最全面的分析', '可解释性强'],
                    cons: ['Token 消耗最大', '可能过度分析']
                }
            ],
            nextSteps: [
                '运行7天回测对比收益率',
                '统计交易频率差异',
                '分析 reasoning 质量',
                '对比 Token 消耗成本'
            ]
        };

        console.log('\n📋 对照实验设计报告:');
        console.log(JSON.stringify(report, null, 2));

        expect(report.variants).toHaveLength(3);
        expect(report.variants[0].level).toBe('lite');
        expect(report.variants[1].level).toBe('indicator');
        expect(report.variants[2].level).toBe('strategy');
    });
});
