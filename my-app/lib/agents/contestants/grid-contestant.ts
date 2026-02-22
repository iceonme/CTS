import { Contestant } from '../../core/contestant';
import { IClock } from '../../core/clock';
import { VirtualPortfolio } from '../../trading/portfolio';
import { MarketDatabase } from '../../data/market-db';
import { getRecentPivots } from '../../trading/pivot-detector';
import { analyzeVolatility, VolatilityResult } from '../../trading/volatility-calculator';
import { to15m } from '../../trading/kline-aggregator';

/**
 * GridContestant 配置
 */
export interface GridConfig {
    symbol: string;               // 交易对，如 'BTCUSDT'
    tradeAmount: number;          // 每次交易金额（USDT）
    gridLevels: number;           // 买卖级数，默认 3
    pivotN: number;               // 枢轴点 N 值，默认 5
    windowDays: number;           // 回看窗口天数，默认 30
    volatilityMin: number;        // 最低波动率 %，默认 3
    volatilityMax: number;        // 最高波动率 %，默认 5
    stopLossPercent: number;      // 硬止损百分比，默认 2
    takeProfitPercent: number;    // 浮盈保护百分比，默认 4
    recalcIntervalMinutes: number;// 重新计算枢轴点的最短间隔（分钟），默认 60
}

/**
 * 网格状态 — 记录当前的买卖点位和触发状态
 */
interface GridState {
    buyLevels: number[];          // 买入价位（升序，最低在前）
    sellLevels: number[];         // 卖出价位（降序，最高在前）
    buyTriggered: boolean[];      // 各买入点是否已触发
    sellTriggered: boolean[];     // 各卖出点是否已触发
    lastCalcTimestamp: number;    // 上次计算枢轴点的时间
    volatility: VolatilityResult | null;  // 当前波动率状态
    paused: boolean;              // 是否因波动率暂停
}

/**
 * GridContestant - 高抛低吸策略参赛者
 * 
 * 策略：
 * 1. 从历史K线中识别枢轴高低点作为买卖价位
 * 2. 价格触达低点 → 买入固定金额
 * 3. 价格触达高点 → 卖出固定金额
 * 4. 三层风控：硬止损、波动率熔断、浮盈保护
 */
export class GridContestant implements Contestant {
    public readonly id: string;
    public readonly name: string;

    private portfolio!: VirtualPortfolio;
    private clock!: IClock;
    private db: MarketDatabase;
    private config: GridConfig;
    private gridState: GridState;
    private initialized: boolean = false;
    private lastBuyTick: number = 0; // 记录上次买入的 Tick 计数
    private tickCount: number = 0;   // 当前 Tick 计数

    // 日志缓存
    private logBuffer: any[] = [];

    constructor(id: string, name: string, db: MarketDatabase, config: Partial<GridConfig> & { symbol: string }) {
        this.id = id;
        this.name = name;
        this.db = db;

        // 合并默认配置
        this.config = {
            symbol: config.symbol,
            tradeAmount: config.tradeAmount || 2000,
            gridLevels: config.gridLevels || 3,
            pivotN: config.pivotN || 3,
            windowDays: config.windowDays || 7,
            volatilityMin: config.volatilityMin || 2,
            volatilityMax: config.volatilityMax || 50,
            stopLossPercent: config.stopLossPercent || 2,
            takeProfitPercent: config.takeProfitPercent || 4,
            recalcIntervalMinutes: config.recalcIntervalMinutes || 60,
        };

        // 初始网格状态
        this.gridState = {
            buyLevels: [],
            sellLevels: [],
            buyTriggered: [],
            sellTriggered: [],
            lastCalcTimestamp: 0,
            volatility: null,
            paused: false,
        };
    }

    async initialize(initialCapital: number, clock: IClock): Promise<void> {
        this.clock = clock;
        this.portfolio = new VirtualPortfolio(initialCapital, clock);

        // 如果没有显式设置 tradeAmount，自动根据初始资金 / gridLevels 计算
        if (!this.config.tradeAmount || this.config.tradeAmount === 2000) {
            this.config.tradeAmount = initialCapital / this.config.gridLevels;
        }

        this.initialized = true;
        this.log(`🚀 初始化完成 | 资金: $${initialCapital} | 模式: 1/N 动态仓位 | 窗口: ${this.config.windowDays}天 | 精度(N): ${this.config.pivotN}`);
    }

    async onTick(): Promise<void> {
        if (!this.initialized) return;

        this.tickCount++;
        const now = this.clock.now();

        // 获取当前价格
        const currentPrice = await this.getCurrentPrice(now);
        if (currentPrice === null) return;

        // 更新持仓估值
        this.portfolio.updatePrice(this.config.symbol, currentPrice);

        // 1. 检查是否需要重新计算枢轴点
        // 只在以下情况重算，不定时重算（避免覆盖未触发的点位）
        const allBuyTriggered = this.gridState.buyTriggered.length > 0 && this.gridState.buyTriggered.every(t => t);
        const allSellTriggered = this.gridState.sellTriggered.length > 0 && this.gridState.sellTriggered.every(t => t);
        const needsInit = this.gridState.buyLevels.length === 0 && this.gridState.sellLevels.length === 0;

        if (needsInit || allBuyTriggered || allSellTriggered) {
            const reason = needsInit ? '初始化' : allBuyTriggered ? '所有买入点已触发' : '所有卖出点已触发';
            this.log(`🔄 触发网格重算（${reason}）`);
            await this.recalculateGrid(now);
        }

        // 如果没有有效的网格点位，跳过
        if (this.gridState.buyLevels.length === 0 && this.gridState.sellLevels.length === 0) {
            return;
        }

        // 2. 波动率日志（不再暂停，仅记录）

        // 3. 硬止损检查
        if (this.checkStopLoss(currentPrice)) {
            return;
        }

        // 4. 浮盈保护检查
        if (this.checkTakeProfit(currentPrice)) {
            return;
        }

        // 5. 买入检查：当前价 ≤ 某个低点
        this.checkBuySignals(currentPrice);

        // 6. 卖出检查：当前价 ≥ 某个高点
        this.checkSellSignals(currentPrice);

        // 记录快照
        this.portfolio.takeSnapshot();
    }

    /**
     * 重新计算网格点位
     */
    private async recalculateGrid(now: number): Promise<void> {
        const windowMs = this.config.windowDays * 24 * 60 * 60 * 1000;
        const startTime = new Date(now - windowMs);

        // 查询1分钟K线（数据库只存 1m 数据）
        const klines = await this.db.queryKlines({
            symbol: this.config.symbol,
            interval: '1m',
            start: startTime,
            end: new Date(now),
            limit: 50000, // 30天 × 1440根/天 = 43200 根，留余量
        });

        if (klines.length < 2 * this.config.pivotN + 1) {
            this.log(`⚠️ K线数据不足（${klines.length} 根），无法计算枢轴点`);
            return;
        }

        // queryKlines 返回降序数据，枢轴检测需要升序
        klines.sort((a, b) => a.timestamp - b.timestamp);

        // 将1分钟K线聚合为15分钟K线，减少噪声
        const klines15m = to15m(klines);

        if (klines15m.length < 2 * this.config.pivotN + 1) {
            this.log(`⚠️ 聚合后K线数据不足（${klines15m.length} 根15m），无法计算枢轴点（原始1m: ${klines.length} 根）`);
            return;
        }

        // 计算波动率（仅记录，不暂停）
        const volResult = analyzeVolatility(klines15m, this.config.volatilityMin, this.config.volatilityMax);
        this.gridState.volatility = volResult;
        this.gridState.paused = false;

        if (!volResult.inRange) {
            this.log(`📊 波动率 ${volResult.volatility.toFixed(2)}% 超出理想范围 [${this.config.volatilityMin}%, ${this.config.volatilityMax}%]，但继续交易`);
        }

        // 计算枢轴点
        const pivots = getRecentPivots(klines15m, this.config.pivotN, this.config.gridLevels);

        // 获取当前价格，用于过滤无效点位
        const currentPrice = klines15m[klines15m.length - 1].close;

        // 过滤：买入点必须低于当前价
        let validBuyLevels = pivots.lows.filter(p => p < currentPrice * 0.999);
        // 过滤：卖出点必须高于当前价
        let validSellLevels = pivots.highs.filter(p => p > currentPrice * 1.001);

        // 合成补充：当有效点位不足 gridLevels 个时，自动生成
        const levelSpacing = 0.015; // 每级间距 1.5%

        while (validBuyLevels.length < this.config.gridLevels) {
            // 从最低的现有买入点往下生成，或从当前价往下
            const base = validBuyLevels.length > 0
                ? validBuyLevels[0]  // 已升序，取最低的
                : currentPrice * (1 - levelSpacing);
            const newLevel = base * (1 - levelSpacing);
            validBuyLevels.unshift(newLevel); // 插入到开头（保持升序）
        }

        while (validSellLevels.length < this.config.gridLevels) {
            // 从最高的现有卖出点往上生成，或从当前价往上
            const base = validSellLevels.length > 0
                ? validSellLevels[validSellLevels.length - 1]  // 取最高的
                : currentPrice * (1 + levelSpacing);
            const newLevel = base * (1 + levelSpacing);
            validSellLevels.push(newLevel); // 插入到末尾
        }

        // 只保留 gridLevels 个
        validBuyLevels = validBuyLevels.slice(-this.config.gridLevels);
        validSellLevels = validSellLevels.slice(0, this.config.gridLevels);

        // 更新网格状态
        this.gridState.buyLevels = validBuyLevels;
        this.gridState.sellLevels = validSellLevels;
        this.gridState.buyTriggered = new Array(validBuyLevels.length).fill(false);
        this.gridState.sellTriggered = new Array(validSellLevels.length).fill(false);
        this.gridState.lastCalcTimestamp = now;

        // 标记合成点位
        const synthBuy = validBuyLevels.length - pivots.lows.filter(p => p < currentPrice * 0.999).length;
        const synthSell = validSellLevels.length - pivots.highs.filter(p => p > currentPrice * 1.001).length;

        this.log(`🔄 网格重算完成 | 当前价: $${currentPrice.toFixed(0)} | 买入点: [${validBuyLevels.map(p => p.toFixed(0)).join(', ')}] | 卖出点: [${validSellLevels.map(p => p.toFixed(0)).join(', ')}] | 波动率: ${volResult.volatility.toFixed(2)}%${synthBuy > 0 ? ` | 合成买${synthBuy}个` : ''}${synthSell > 0 ? ` | 合成卖${synthSell}个` : ''}`);
    }

    /**
     * 检查买入信号
     */
    private checkBuySignals(currentPrice: number): void {
        for (let i = 0; i < this.gridState.buyLevels.length; i++) {
            if (this.gridState.buyTriggered[i]) continue;

            const buyLevel = this.gridState.buyLevels[i];
            if (currentPrice <= buyLevel) {
                // 交易频率限制：每 3 个 Tick 最多买一笔
                if (this.tickCount - this.lastBuyTick < 3) {
                    continue;
                }

                // 动态计算买入金额：当前余额 / 总级数 (用户要求的算法)
                const balance = this.portfolio.getOverview().balance;
                const tradeAmount = balance / this.config.gridLevels;

                if (tradeAmount < 10) {
                    // 余额太少，标记已触发避免重复报错
                    this.gridState.buyTriggered[i] = true;
                    this.log(`⚠️ 买入 L${i + 1} 跳过（余额不足 $${balance.toFixed(0)}）`);
                    continue;
                }

                const quantity = tradeAmount / currentPrice;

                const success = this.portfolio.executeTrade(
                    this.config.symbol,
                    'BUY',
                    currentPrice,
                    quantity,
                    `网格买入 L${i + 1}（触发价: ${buyLevel.toFixed(0)}, 实际价: ${currentPrice.toFixed(0)}）`
                );

                if (success) {
                    this.gridState.buyTriggered[i] = true;
                    this.lastBuyTick = this.tickCount; // 更新冷却时间
                    this.log(`✅ 买入 L${i + 1} | 价格: $${currentPrice.toFixed(0)} ≤ $${buyLevel.toFixed(0)} | 金额: $${tradeAmount.toFixed(0)} (余额的 1/${this.config.gridLevels}) | Tick: ${this.tickCount}`);
                } else {
                    this.gridState.buyTriggered[i] = true; // 失败也标记，避免每 tick 重复报错
                    this.log(`❌ 买入 L${i + 1} 失败 | 价格: $${currentPrice.toFixed(0)}`);
                }
            }
        }
    }

    /**
     * 检查卖出信号
     */
    private checkSellSignals(currentPrice: number): void {
        for (let i = 0; i < this.gridState.sellLevels.length; i++) {
            if (this.gridState.sellTriggered[i]) continue;

            const sellLevel = this.gridState.sellLevels[i];
            if (currentPrice >= sellLevel) {
                // 检查是否有持仓
                const overview = this.portfolio.getOverview();
                const position = overview.positions.find((p: any) => p.symbol === this.config.symbol);
                const totalQty = position ? position.quantity : 0;

                if (totalQty * currentPrice < 10) {
                    // 持仓不足，跳过但不标记（等买入后再卖）
                    continue;
                }

                // 动态计算卖出数量：当前持仓 / 剩余未触发的卖出点数
                const remainingSells = this.gridState.sellTriggered.filter(t => !t).length;
                const sellQty = totalQty / remainingSells;
                const sellValue = sellQty * currentPrice;

                const success = this.portfolio.executeTrade(
                    this.config.symbol,
                    'SELL',
                    currentPrice,
                    sellQty,
                    `网格卖出 H${i + 1}（触发价: ${sellLevel.toFixed(0)}, 实际价: ${currentPrice.toFixed(0)}）`
                );

                if (success) {
                    this.gridState.sellTriggered[i] = true;
                    this.log(`✅ 卖出 H${i + 1} | 价格: $${currentPrice.toFixed(0)} ≥ $${sellLevel.toFixed(0)} | 数量: ${sellQty.toFixed(4)} ($${sellValue.toFixed(0)}) (1/${remainingSells})`);
                } else {
                    this.log(`❌ 卖出 H${i + 1} 失败 | 价格: $${currentPrice.toFixed(0)}`);
                }
            }
        }
    }

    /**
     * 硬止损检查
     * 当价格跌破最低买入点 × (1 - stopLossPercent%) 时，全仓清出
     */
    private checkStopLoss(currentPrice: number): boolean {
        if (this.gridState.buyLevels.length === 0) return false;

        const lowestBuy = this.gridState.buyLevels[0]; // 已升序排列
        const stopLossPrice = lowestBuy * (1 - this.config.stopLossPercent / 100);

        if (currentPrice < stopLossPrice) {
            const overview = this.portfolio.getOverview();
            const position = overview.positions.find((p: any) => p.symbol === this.config.symbol);

            if (position && position.quantity > 0) {
                this.portfolio.executeTrade(
                    this.config.symbol,
                    'SELL',
                    currentPrice,
                    position.quantity,
                    `🔴 硬止损触发（价格 $${currentPrice.toFixed(0)} < 止损线 $${stopLossPrice.toFixed(0)}）`
                );
                this.log(`🔴 硬止损！全仓清出 | 价格: $${currentPrice.toFixed(0)} < $${stopLossPrice.toFixed(0)} | 卖出全部持仓`);

                // 暂停交易，等待波动率恢复
                this.gridState.paused = true;
            }
            return true;
        }

        return false;
    }

    /**
     * 浮盈保护检查
     * 当总仓位浮盈超过 takeProfitPercent% 时，卖出50%仓位
     */
    private checkTakeProfit(currentPrice: number): boolean {
        const overview = this.portfolio.getOverview();
        const position = overview.positions.find((p: any) => p.symbol === this.config.symbol);

        if (!position || position.quantity <= 0) return false;

        const avgCost = position.avgPrice;
        const profitPercent = ((currentPrice - avgCost) / avgCost) * 100;

        if (profitPercent >= this.config.takeProfitPercent) {
            const sellQuantity = position.quantity * 0.5;

            this.portfolio.executeTrade(
                this.config.symbol,
                'SELL',
                currentPrice,
                sellQuantity,
                `🟢 浮盈保护（浮盈 ${profitPercent.toFixed(1)}% ≥ ${this.config.takeProfitPercent}%）`
            );
            this.log(`🟢 浮盈保护触发 | 浮盈: ${profitPercent.toFixed(1)}% | 卖出50%仓位 @ $${currentPrice.toFixed(0)}`);

            return true;
        }

        return false;
    }

    /**
     * 获取当前价格
     */
    private async getCurrentPrice(now: number): Promise<number | null> {
        const klines = await this.db.queryKlines({
            symbol: this.config.symbol,
            interval: '1m',
            end: new Date(now),
            limit: 1
        });

        if (klines.length === 0) return null;
        return klines[0].close;
    }

    /**
     * 日志记录
     */
    private log(message: string): void {
        const timestamp = new Date(this.clock.now()).toISOString();
        console.log(`[Grid:${this.name}] ${message}`);
        this.logBuffer.push({
            timestamp: this.clock.now(),
            message: `[Grid] ${message}`,
            time: timestamp
        });
    }

    // ========== Contestant 接口实现 ==========

    getPortfolio(): VirtualPortfolio {
        return this.portfolio;
    }

    getLogs(): any[] {
        const logs = [...this.logBuffer];
        this.logBuffer = [];
        return logs;
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
