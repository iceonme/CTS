import { Contestant } from '../../core/contestant';
import { IClock } from '../../core/clock';
import { VirtualPortfolio } from '../../trading/portfolio';
import { MarketDatabase } from '../../data/market-db';

/**
 * DCAContestant - 定投策略参赛者 (人类基准组)
 * 
 * 策略：每过固定的时间步长（如 1天/1周），不问价格买入固定金额。
 */
export class DCAContestant implements Contestant {
    public readonly id: string;
    public readonly name: string;

    private portfolio!: VirtualPortfolio;
    private clock!: IClock;
    private db: MarketDatabase;
    private symbol: string;

    private investAmount: number; // 每次投入金额
    private intervalMinutes: number; // 投入间隔（分钟）
    private lastInvestTimestamp: number = 0;

    constructor(id: string, name: string, db: MarketDatabase, config: { symbol: string, investAmount: number, intervalMinutes: number }) {
        this.id = id;
        this.name = name;
        this.db = db;
        this.symbol = config.symbol;
        this.investAmount = config.investAmount;
        this.intervalMinutes = config.intervalMinutes;
    }

    async initialize(initialCapital: number, clock: IClock): Promise<void> {
        this.clock = clock;
        this.portfolio = new VirtualPortfolio(initialCapital, clock);
        this.lastInvestTimestamp = 0; // 第一次 tick 即可触发
    }

    async onTick(): Promise<void> {
        const now = this.clock.now();

        // 检查是否到了定投资间点
        if (now - this.lastInvestTimestamp >= this.intervalMinutes * 60 * 1000) {
            // 1. 获取当前价格（通过 DB 限制当前时间可见性）
            const klines = await this.db.queryKlines({
                symbol: this.symbol,
                interval: '1m',
                end: new Date(now),
                limit: 1
            });

            if (klines.length > 0) {
                const currentPrice = klines[0].close;
                const quantity = this.investAmount / currentPrice;

                // 3. 执行买入
                const success = this.portfolio.executeTrade(
                    this.symbol,
                    'BUY',
                    currentPrice,
                    quantity,
                    `DCA recurring investment`
                );

                if (success) {
                    console.log(`[DCA] ${this.name} invested $${this.investAmount} at $${currentPrice}`);
                }
                // 无论是否成功买入，都记录本次尝试的时间戳，防止因余额不足导致的每回合重试
                this.lastInvestTimestamp = now;
            }
        }

        // 定期记录快照
        this.portfolio.takeSnapshot();
    }

    getPortfolio(): VirtualPortfolio {
        return this.portfolio;
    }

    getTrades(startIndex: number = 0): any[] {
        const trades = this.portfolio.getTradesIncremental(startIndex);
        return trades.map((t: any) => ({
            ...t,
            createdAt: new Date(t.timestamp),
            total: t.totalUsdt
        }) as any);
    }

    getMetrics(): any {
        return this.portfolio.getOverviewBasic();
    }
}
