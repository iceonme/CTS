import { MarketDatabase } from '../lib/data/market-db';
import { ReplayEngine } from '../lib/core/replay-engine';
import { TechnicalAnalyst } from '../lib/agents/tech-analyst';
import { PA } from '../lib/agents/pa';
import { feedBus } from '../lib/core/feed';
import path from 'path';

async function main() {
    const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
    console.log('--- TradeMind Replay & Perception Test ---');

    // 1. 初始化数据库
    const db = MarketDatabase.getInstance(dbPath);
    await db.init();

    // 2. 初始化感知组 Agent
    const techAnalyst = new TechnicalAnalyst();
    const pa = new PA();
    pa.setAutoExecute(true);

    console.log('Agents initialized: 技术分析员, PA');

    // 3. 监听全局 Feed 总线并打印
    feedBus.subscribeAll((feed) => {
        const timeStr = new Date(feed.timestamp).toISOString();
        console.log(`[FEED] [${timeStr}] From: ${feed.fromName || feed.from} | Type: ${feed.type} | Msg: ${(feed.data as any).description || 'No desc'}`);
        if (feed.type === 'analysis') {
            const d = feed.data as any;
            console.log(`       >>> Signal: ${d.signalType} | RSI: ${d.indicators?.rsi?.toFixed(2)} | Trend: ${d.indicators?.ma?.short > d.indicators?.ma?.long ? 'UP' : 'DOWN'}`);
        }
    });

    // 4. 配置回放引擎
    // 我们选 2025-01-01 01:00 开始（预留一小时历史数据计算指标）
    const start = new Date('2025-01-01T01:00:00Z');
    const end = new Date('2025-01-01T06:00:00Z');

    const engine = new ReplayEngine(db, {
        symbol: 'BTCUSDT',
        interval: '1m',
        start,
        end,
        stepMinutes: 10,  // 每步前进 10 分钟，加快测试速度
        delayMs: 500      // 每步停顿 0.5s 方便观察
    });

    // 5. 启动回放
    await engine.start();

    console.log('--- Test Finished ---');
    // 等待异步任务处理完毕
    await new Promise(r => setTimeout(r, 2000));
    await db.close();
}

main().catch(console.error);
