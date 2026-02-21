import { VirtualClock } from './clock';
import { Contestant } from './contestant';
import { ReplayEngine, ReplayConfig } from './replay-engine';
import { MarketDatabase } from '../data/market-db';

export interface RaceResult {
    contestantId: string;
    name: string;
    finalEquity: number;
    totalReturn: number;
    tradeCount: number;
    sharpeRatio: number;
    maxDrawdown: number;
}

/**
 * RaceController - 比赛控制器
 * 
 * 协调回放引擎、虚拟时钟和所有参赛者，驱动整个回测实验流程。
 */
export class RaceController {
    private clock: VirtualClock;
    private contestants: Contestant[] = [];
    private db: MarketDatabase;
    private config: ReplayConfig;

    constructor(db: MarketDatabase, config: ReplayConfig) {
        this.db = db;
        this.config = config;
        this.clock = new VirtualClock(config.start.getTime());
    }

    /**
     * 添加参赛者
     */
    addContestant(contestant: Contestant): void {
        this.contestants.push(contestant);
    }

    /**
   * 运行比赛
   * @param onProgress 进度回调 (可选)
   * @param abortSignal 中止信号
   */
    async run(
        onProgress?: (data: {
            timestamp: number;
            progress: number;
            equities?: Record<string, number>;
            positions?: Record<string, { btc: number; usdt: number }>;
            logs?: Record<string, any[]>;
            trades?: Record<string, any[]>;
        }) => void,
        abortSignal?: AbortSignal
    ): Promise<RaceResult[]> {
        console.log(`[RaceController] Starting race from ${this.config.start.toISOString()} to ${this.config.end.toISOString()}`);

        // 1. 初始化所有参赛者
        const initialCapital = 10000; // 后续可以从配置中读取，目前统一为 10000
        const lastTradeCount: Record<string, number> = {};
        for (const contestant of this.contestants) {
            await contestant.initialize(initialCapital, this.clock);
            lastTradeCount[contestant.id] = 0;
            console.log(`[RaceController] Initialized contestant: ${contestant.name}`);
        }

        // 2. 步进循环
        let currentTimestamp = this.config.start.getTime();
        const endTimestamp = this.config.end.getTime();
        const stepMs = this.config.stepMinutes * 60 * 1000;

        let stepCount = 0;
        while (currentTimestamp <= endTimestamp) {
            // 检查异常终止
            if (abortSignal?.aborted) {
                console.log(`[RaceController] Race aborted by signal.`);
                throw new Error('BACKTEST_ABORTED');
            }

            // 更新虚拟时钟
            this.clock.setCurrentTime(currentTimestamp);

            // 每步获取最新价格并更新所有选手的持仓估值
            const klines = await this.db.queryKlines({
                symbol: this.config.symbol,
                interval: '1m',
                end: new Date(currentTimestamp),
                limit: 1
            });
            if (klines.length > 0) {
                const currentPrice = klines[0].close;
                for (const contestant of this.contestants) {
                    contestant.getPortfolio().updatePrice(this.config.symbol, currentPrice);
                }
            }

            // 通知所有参赛者执行 onTick
            for (const contestant of this.contestants) {
                await contestant.onTick();
            }

            // 进度上报
            if (onProgress) {
                const isDrawTick = true; // 每一步都采集净值点，确保图表实时更新
                const progress = (currentTimestamp - this.config.start.getTime()) / (endTimestamp - this.config.start.getTime());

                let equities: Record<string, number> | undefined = undefined;
                let positions: Record<string, { btc: number; usdt: number }> | undefined = undefined;
                if (isDrawTick) {
                    equities = {};
                    positions = {};
                    this.contestants.forEach(c => {
                        equities![c.id] = c.getPortfolio().getTotalEquity();
                        const overview = c.getPortfolio().getOverview();
                        const btcPos = overview.positions.find((p: any) => p.symbol === this.config.symbol);
                        positions![c.id] = {
                            btc: btcPos ? btcPos.quantity : 0,
                            usdt: overview.balance
                        };
                    });
                }

                const logs: Record<string, any[]> = {};
                const trades: Record<string, any[]> = {};

                this.contestants.forEach(c => {
                    // 日志提取
                    if (c.getLogs) {
                        const newLogs = c.getLogs();
                        if (newLogs.length > 0) logs[c.id] = newLogs;
                    }
                    // 交易提取 (增量)
                    if (c.getTrades) {
                        const newTrades = c.getTrades(lastTradeCount[c.id]);
                        if (newTrades.length > 0) {
                            trades[c.id] = newTrades;
                            lastTradeCount[c.id] += newTrades.length;
                        }
                    }
                });

                if (isDrawTick || Object.keys(logs).length > 0 || Object.keys(trades).length > 0) {
                    onProgress({
                        timestamp: currentTimestamp,
                        progress: progress * 100,
                        equities,
                        positions,
                        logs: Object.keys(logs).length > 0 ? logs : undefined,
                        trades: Object.keys(trades).length > 0 ? trades : undefined
                    });
                }
            }

            // 推进时间
            currentTimestamp += stepMs;
            stepCount++;

            if (stepCount % 100 === 0) {
                const progressPercent = ((currentTimestamp - this.config.start.getTime()) / (endTimestamp - this.config.start.getTime()) * 100).toFixed(1);
                console.log(`[RaceController] Progress: ${progressPercent}%`);
            }
        }

        console.log(`[RaceController] Race finished.`);

        // 3. 收集结果
        return this.collectResults();
    }

    private collectResults(): RaceResult[] {
        return this.contestants.map(c => {
            const portfolio = c.getPortfolio();
            const overview = portfolio.getOverview();
            const initialCapital = overview.initialBalance;

            return {
                contestantId: c.id,
                name: c.name,
                finalEquity: overview.totalEquity,
                totalReturn: (overview.totalEquity - initialCapital) / initialCapital,
                tradeCount: overview.tradeCount,
                sharpeRatio: (overview as any).sharpeRatio || 0,
                maxDrawdown: (overview as any).maxDrawdown || 0
            };
        });
    }
}
