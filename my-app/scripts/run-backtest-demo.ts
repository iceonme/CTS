import { MarketDatabase } from '../lib/data/market-db';
import { RaceController } from '../lib/core/race-controller';
import { DCAContestant } from '../lib/agents/contestants/dca-contestant';
import { MASContestant } from '../lib/agents/contestants/mas-contestant';

/**
 * 回测框架演示脚本 - MAS vs DCA
 * 
 * 演示如何对比不同策略的性能。
 */
async function main() {
    console.log('--- TradeMind Backtest: MAS vs DCA ---');

    // 1. 初始化数据库
    const db = MarketDatabase.getInstance();
    await db.init();

    // 2. 确定回测时间范围
    // 数据段：2025-01-01 到 2025-01-03 (回测2天，验证逻辑)
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-01-03T00:00:00Z');

    console.log(`Time Range: ${start.toISOString()} to ${end.toISOString()}`);

    // 3. 配置比赛控制器
    const controller = new RaceController(db, {
        symbol: 'BTCUSDT',
        interval: '1m',
        start,
        end,
        stepMinutes: 1, // 每步前进 1 分钟，保证高频分析能触发
    });

    // 4. 添加参赛者 1：DCA 选手 (每12小时买入 500 USDT)
    const dcaBot = new DCAContestant(
        'dca-500',
        'DCA (500/12h)',
        db,
        {
            symbol: 'BTCUSDT',
            investAmount: 500,
            intervalMinutes: 60 * 12
        }
    );
    controller.addContestant(dcaBot);

    // 5. 添加参赛者 2：MAS 小队 (Tech + PA)
    const masSquad = new MASContestant(
        'mas-squad-1',
        'TradeMind MAS Squad',
        db,
        'BTCUSDT'
    );
    controller.addContestant(masSquad);

    // 6. 运行比赛
    console.log('\n--- Racing Start ---');
    const results = await controller.run();

    // 7. 输出对比结果
    console.log('\n' + '='.repeat(40));
    console.log('FINAL LEADERBOARD');
    console.log('='.repeat(40));

    results.sort((a, b) => b.finalEquity - a.finalEquity).forEach((res, index) => {
        const medal = index === 0 ? '🏆' : '🥈';
        console.log(`${medal} ${res.name.padEnd(20)} | Equity: $${res.finalEquity.toFixed(2).padStart(8)} | Return: ${(res.totalReturn * 100).toFixed(2).padStart(6)}% | Trades: ${res.tradeCount}`);
    });
    console.log('='.repeat(40));

    db.close();
}

main().catch(console.error);
