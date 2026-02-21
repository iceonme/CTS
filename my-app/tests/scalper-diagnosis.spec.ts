import { test, expect } from '@playwright/test';
import { MarketDatabase } from '../lib/data/market-db';
import { RaceController } from '../lib/core/race-controller';
import { LLMSoloContestant } from '../lib/agents/contestants/llm-solo-contestant';

test.describe('Scalper Performance Diagnosis (1h vs 12h)', () => {

    // 我们使用实际数据库中的一小段数据运行真实回测模拟
    test('对比 1h vs 12h 步长下的交易频率和收益', async () => {
        const db = MarketDatabase.getInstance();
        await db.init();

        const symbol = 'BTCUSDT';
        // 选取一段有波动的时间：2025-01-01 到 2025-01-03 (3天)
        const start = new Date('2025-01-01T00:00:00Z');
        const end = new Date('2025-01-03T00:00:00Z');

        // Mock LLM Client 模拟真实响应逻辑，但更快且无成本
        const mockMinimax = {
            chat: async (prompt: string) => {
                // 模拟一个简单的基于 RSI 的逻辑
                const rsiMatch = prompt.match(/RSI\(14\):\s*(\d+)/);
                if (rsiMatch) {
                    const rsi = parseInt(rsiMatch[1]);
                    if (rsi < 35) return JSON.stringify({ decision: 'BUY', percentage: 0.5, reasoning: 'RSI 超卖，博反弹', confidence: 80 });
                    if (rsi > 65) return JSON.stringify({ decision: 'SELL', percentage: 0.5, reasoning: 'RSI 超买，止盈', confidence: 80 });
                }
                return JSON.stringify({ decision: 'WAIT', percentage: 0, reasoning: '无明显机会', confidence: 50 });
            }
        } as any;

        // --- 实验 A: 12h 步长 (现状) ---
        const controllerA = new RaceController(db, {
            symbol, interval: '1m', start, end, stepMinutes: 720
        });
        const scalperA = new LLMSoloContestant('scalper-12h', 'Scalper-12h', db, mockMinimax, symbol, { intelligenceLevel: 'scalper' });
        controllerA.addContestant(scalperA);
        const [resultA] = await controllerA.run();

        // --- 实验 B: 1h 步长 (对比组) ---
        const controllerB = new RaceController(db, {
            symbol, interval: '1m', start, end, stepMinutes: 60
        });
        const scalperB = new LLMSoloContestant('scalper-1h', 'Scalper-1h', db, mockMinimax, symbol, { intelligenceLevel: 'scalper' });
        controllerB.addContestant(scalperB);
        const [resultB] = await controllerB.run();

        console.log('\n📊 诊断实验结果 (3天回测):');
        console.log(`[12h 步长] 交易次数: ${resultA.tradeCount}, 最终收益率: ${(resultA.totalReturn * 100).toFixed(2)}%`);
        console.log(`[1h 步长] 交易次数: ${resultB.tradeCount}, 最终收益率: ${(resultB.totalReturn * 100).toFixed(2)}%`);

        // 预期 1h 下交易应该更活跃
        expect(resultB.tradeCount).toBeGreaterThanOrEqual(resultA.tradeCount);
    });
});
