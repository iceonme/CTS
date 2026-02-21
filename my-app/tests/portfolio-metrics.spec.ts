import { test, expect } from '@playwright/test';
import { VirtualPortfolio } from '../lib/trading/portfolio';

test.describe('Portfolio Metrics Validation', () => {
    const mockClock = { _time: 0, now: () => mockClock._time, set: (t: number) => mockClock._time = t };

    test('计算最大回撤正确', () => {
        const vp = new VirtualPortfolio(10000, mockClock as any);

        // 初始状态
        vp.takeSnapshot(); // 10000

        // 模拟权益增长到 12000
        mockClock.set(1000);
        vp.executeTrade('BTC', 'BUY', 1000, 10); // 花掉 10000 买 10 BTC
        vp.updatePrice('BTC', 1200); // 10 * 1200 = 12000
        vp.takeSnapshot();

        // 模拟回撤到 9000 (从 12000 回撤 25%)
        mockClock.set(2000);
        vp.updatePrice('BTC', 900);
        vp.takeSnapshot();

        // 模拟回升到 11000 (仍小于 12000，回撤仍存在)
        mockClock.set(3000);
        vp.updatePrice('BTC', 1100);
        vp.takeSnapshot();

        const overview = vp.getOverview();
        console.log(`Max Drawdown: ${overview.maxDrawdown}%`);

        // 最大回撤应该是 (12000 - 9000) / 12000 = 25%
        expect(overview.maxDrawdown).toBe(25);
    });

    test('夏普比率计算逻辑不报错', () => {
        const vp = new VirtualPortfolio(10000, mockClock as any);

        // 模拟一段时间的波动收益
        for (let i = 0; i < 10; i++) {
            mockClock.set(i * 1000);
            const price = 1000 + (Math.random() - 0.4) * 100; // 偏向上涨
            vp.updatePrice('BTC', price);
            vp.takeSnapshot();
        }

        const overview = vp.getOverview();
        console.log(`Sharpe Ratio: ${overview.sharpeRatio}`);

        // 只要能算出来且是数字即可（由于是随机生成的，具体的夏普值不固定）
        expect(typeof overview.sharpeRatio).toBe('number');
        expect(isNaN(overview.sharpeRatio)).toBe(false);
    });
});
