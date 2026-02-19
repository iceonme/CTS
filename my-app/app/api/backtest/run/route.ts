import { NextRequest, NextResponse } from 'next/server';
import { MarketDatabase } from '@/lib/data/market-db';
import { RaceController } from '@/lib/core/race-controller';
import { DCAContestant } from '@/lib/agents/contestants/dca-contestant';
import { MASContestant } from '@/lib/agents/contestants/mas-contestant';
import { LLMSoloContestant } from '@/lib/agents/contestants/llm-solo-contestant';
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

            // 3. LLM 单兵
            if (contestantId === 'llm-solo' || (typeof conf === 'object' && conf.type === 'llm-solo')) {
                const minimaxKey = process.env.MINIMAX_API_KEY;
                const minimaxGroupId = process.env.MINIMAX_GROUP_ID;

                if (minimaxKey) {
                    const minimax = new MiniMaxClient(minimaxKey, minimaxGroupId);
                    const llmSolo = new LLMSoloContestant(
                        typeof conf === 'string' ? 'llm-solo' : conf.id,
                        typeof conf === 'string' ? 'LLM 单兵 (MiniMax)' : (conf.name || '自定义 LLM'),
                        db,
                        minimax,
                        symbol,
                        settings.systemPrompt
                    );
                    controller.addContestant(llmSolo);
                    console.log(`[Backtest API] Added LLM Solo contestant: ${llmSolo.name}`);
                } else {
                    console.warn('[Backtest API] MiniMax API Key missing, skipping LLM Solo');
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
