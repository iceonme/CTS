import { NextRequest, NextResponse } from 'next/server';
import { MarketDatabase } from '@/lib/data/market-db';
import { RaceController } from '@/lib/core/race-controller';
import { DCAContestant } from '@/lib/agents/contestants/dca-contestant';
import { MASContestant } from '@/lib/agents/contestants/mas-contestant';
import { LLMSoloContestant } from '@/lib/agents/contestants/llm-solo-contestant';
import { GridContestant } from '@/lib/agents/contestants/grid-contestant';
import { MiniMaxClient } from '@/lib/core/minimax';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { start, end, symbol, interval, stepMinutes, initialCapital = 10000, contestants = ['dca-bot', 'llm-solo'] } = body;

        if (!start || !end || !symbol) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const db = MarketDatabase.getInstance();
        await db.init();

        const controller = new RaceController(db, {
            symbol,
            interval: interval || '1m',
            start: new Date(start),
            end: new Date(end),
            stepMinutes: stepMinutes || 15,
        });

        // 解析参赛选手
        const contestantConfigs = contestants as any[];

        for (const conf of contestantConfigs) {
            const contestantId = typeof conf === 'string' ? conf : conf.id;
            const settings = typeof conf === 'string' ? {} : (conf.settings || {});

            // 1. DCA 选手
            if (contestantId === 'dca-bot' || (typeof conf === 'object' && conf.type === 'dca')) {
                const dcaBot = new DCAContestant(
                    typeof conf === 'string' ? 'dca-bot' : conf.id,
                    typeof conf === 'string' ? '基准定投 (DCA)' : (conf.name || '自定义定投'),
                    db,
                    {
                        symbol,
                        investAmount: settings.investAmount || initialCapital / 20,
                        intervalMinutes: settings.intervalMinutes || 7 * 24 * 60
                    }
                );
                controller.addContestant(dcaBot);
            }

            // 2. MAS 小队 (固定 ID 或类型)
            if (contestantId === 'mas-squad') {
                const masSquad = new MASContestant(
                    'mas-squad',
                    'MAS 协作小队',
                    db,
                    symbol
                );
                controller.addContestant(masSquad);
            }

            // 3. Grid 高抛低吸选手
            if (contestantId === 'grid-bot' || (typeof conf === 'object' && conf.type === 'grid')) {
                const gridBot = new GridContestant(
                    typeof conf === 'string' ? 'grid-bot' : conf.id,
                    typeof conf === 'string' ? '高抛低吸 (Grid)' : (conf.name || '自定义网格'),
                    db,
                    {
                        symbol,
                        tradeAmount: settings.tradeAmount || initialCapital / (settings.gridLevels || 3),
                        gridLevels: settings.gridLevels || 3,
                        pivotN: settings.pivotN || 3,
                        windowDays: settings.windowDays || 7,
                        volatilityMin: settings.volatilityMin || 3,
                        volatilityMax: settings.volatilityMax || 5,
                        stopLossPercent: settings.stopLossPercent || 2,
                        takeProfitPercent: settings.takeProfitPercent || 4,
                        recalcIntervalMinutes: settings.recalcIntervalMinutes || 60,
                    }
                );
                controller.addContestant(gridBot);
                console.log(`[Backtest API] Added Grid contestant: ${gridBot.name}`);
            }

            // 4. LLM 单兵 (支持多种ID格式：llm-solo, llm-lite, llm-indicator, llm-strategy)
            if (contestantId.startsWith('llm-') || (typeof conf === 'object' && conf.type === 'llm-solo')) {
                const minimaxKey = process.env.MINIMAX_API_KEY;
                const minimaxGroupId = process.env.MINIMAX_GROUP_ID;

                if (minimaxKey) {
                    const minimax = new MiniMaxClient(minimaxKey, minimaxGroupId);

                    // 构建 LLMSoloConfig
                    const llmConfig = settings.intelligenceLevel ? {
                        intelligenceLevel: settings.intelligenceLevel as 'lite' | 'indicator' | 'strategy',
                        includeDaily: settings.includeDaily || false,
                        customSystemPrompt: settings.systemPrompt
                    } : settings.systemPrompt; // 向后兼容：旧格式使用字符串

                    const llmSolo = new LLMSoloContestant(
                        typeof conf === 'string' ? 'llm-solo' : conf.id,
                        typeof conf === 'string' ? 'LLM 单兵 (MiniMax)' : (conf.name || `LLM-${settings.intelligenceLevel || 'lite'}`),
                        db,
                        minimax,
                        symbol,
                        llmConfig
                    );
                    controller.addContestant(llmSolo);
                    console.log(`[Backtest API] Added LLM Solo contestant: ${llmSolo.name} (${settings.intelligenceLevel || 'lite'})`);
                } else {
                    console.warn('[Backtest API] MiniMax API Key missing, skipping LLM Solo');
                    // 添加一个模拟LLM用于测试（无实际API调用）
                    const mockMinimax = {
                        chat: async (prompt: string, systemPrompt: string) => {
                            console.log(`[MockLLM] Prompt length: ${prompt.length}`);
                            // 模拟决策：根据价格趋势简单判断
                            if (prompt.includes('涨跌:')) {
                                const match = prompt.match(/涨跌:\s*([-\d.]+)%/);
                                if (match) {
                                    const change = parseFloat(match[1]);
                                    if (change < -5) {
                                        return JSON.stringify({ decision: 'BUY', percentage: 0.5, reasoning: '跌幅超过5%，模拟买入', confidence: 70 });
                                    } else if (change > 5) {
                                        return JSON.stringify({ decision: 'SELL', percentage: 0.3, reasoning: '涨幅超过5%，模拟卖出', confidence: 65 });
                                    }
                                }
                            }
                            return JSON.stringify({ decision: 'WAIT', percentage: 0, reasoning: '模拟模式：观望', confidence: 50 });
                        }
                    };

                    const llmConfig = settings.intelligenceLevel ? {
                        intelligenceLevel: settings.intelligenceLevel as 'lite' | 'indicator' | 'strategy',
                        includeDaily: settings.includeDaily || false,
                        customSystemPrompt: settings.systemPrompt
                    } : settings.systemPrompt;

                    const llmSolo = new LLMSoloContestant(
                        typeof conf === 'string' ? 'llm-solo' : conf.id,
                        typeof conf === 'string' ? 'LLM 单兵 (模拟)' : (conf.name + ' (模拟)'),
                        db,
                        mockMinimax as any,
                        symbol,
                        llmConfig
                    );
                    controller.addContestant(llmSolo);
                    console.log(`[Backtest API] Added MOCK LLM Solo (no API key): ${llmSolo.name}`);
                }
            }
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller_stream) {
                try {
                    // 运行回测
                    const results = await controller.run((progressData) => {
                        const chunk = JSON.stringify({
                            type: 'progress',
                            data: {
                                timestamp: progressData.timestamp,
                                equities: progressData.equities,
                                positions: progressData.positions,
                                progress: progressData.progress,
                                logs: progressData.logs,
                                trades: progressData.trades
                            }
                        }) + '\n';
                        controller_stream.enqueue(encoder.encode(chunk));
                    }, req.signal);

                    // 发送最终结果
                    const finalChunk = JSON.stringify({
                        type: 'final',
                        data: { results }
                    }) + '\n';
                    controller_stream.enqueue(encoder.encode(finalChunk));
                    controller_stream.close();
                } catch (err: any) {
                    const errorChunk = JSON.stringify({
                        type: 'error',
                        data: { message: err.message }
                    }) + '\n';
                    controller_stream.enqueue(encoder.encode(errorChunk));
                    controller_stream.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'application/x-ndjson',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error('[Backtest API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
