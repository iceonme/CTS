import { MarketDatabase, type KlineData } from '../data/market-db';
import { feedBus, createFeed } from './feed';

export interface ReplayConfig {
    symbol: string;
    interval: string;
    start: Date;
    end: Date;
    stepMinutes: number; // 每次推进的时间步长（分钟）
    delayMs?: number;    // 回放步进之间的真实等待时间（ms），用于演示
}

export interface ReplayState {
    currentTimestamp: number;
    isPaused: boolean;
    isFinished: boolean;
}

/**
 * ReplayEngine - 数据回放引擎
 * 
 * 充当系统的“时间基准”，从历史数据库读取行情并分发。
 */
export class ReplayEngine {
    private db: MarketDatabase;
    private config: ReplayConfig;
    private state: ReplayState;

    constructor(db: MarketDatabase, config: ReplayConfig) {
        this.db = db;
        this.config = config;
        this.state = {
            currentTimestamp: config.start.getTime(),
            isPaused: false,
            isFinished: false,
        };
    }

    /**
     * 启动回放循环
     */
    async start(): Promise<void> {
        console.log(`[ReplayEngine] Starting replay for ${this.config.symbol} from ${this.config.start.toISOString()}`);

        while (!this.state.isFinished) {
            if (this.state.isPaused) {
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
            }

            await this.step();

            if (this.config.delayMs) {
                await new Promise(resolve => setTimeout(resolve, this.config.delayMs));
            }
        }

        console.log('[ReplayEngine] Replay finished.');
    }

    /**
     * 推进一个时间步
     */
    async step(): Promise<void> {
        const nextTimestamp = this.state.currentTimestamp + (this.config.stepMinutes * 60 * 1000);

        if (nextTimestamp > this.config.end.getTime()) {
            this.state.isFinished = true;
            return;
        }

        // 从数据库查询当前时刻的 K 线（最近 1 条）
        const klines = await this.db.queryKlines({
            symbol: this.config.symbol,
            interval: this.config.interval,
            end: new Date(nextTimestamp),
            limit: 1
        });

        if (klines.length > 0) {
            const currentKline = klines[0];

            // 发布行情 Feed
            // 注意：这里的 timestamp 使用的是回放的历史时间
            const marketFeed = {
                id: `replay-${currentKline.symbol}-${currentKline.timestamp}`,
                from: 'market-replay',
                fromName: '行情回放引擎',
                type: 'signal' as const,
                importance: 'low' as const,
                timestamp: currentKline.timestamp, // 关键：使用回放时间
                data: {
                    symbol: currentKline.symbol,
                    price: {
                        current: currentKline.close,
                    },
                    timeframe: this.config.interval,
                    description: `Price update: $${currentKline.close}`,
                    indicators: {
                        // 这里可以预先计算一些简单指标，或者由后续 Agent 计算
                    }
                } as any
            };

            feedBus.publish(marketFeed);

            // 更新当前时间戳
            this.state.currentTimestamp = nextTimestamp;
        } else {
            console.warn(`[ReplayEngine] No data found for ${new Date(nextTimestamp).toISOString()}`);
            // 即使没数据也尝试推进时间，避免死循环
            this.state.currentTimestamp = nextTimestamp;
        }
    }

    pause(): void {
        this.state.isPaused = true;
    }

    resume(): void {
        this.state.isPaused = false;
    }

    getState(): ReplayState {
        return { ...this.state };
    }
}
