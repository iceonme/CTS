import { Contestant } from '../../core/contestant';
import { IClock } from '../../core/clock';
import { VirtualPortfolio } from '../../trading/portfolio';
import { MarketDatabase } from '../../data/market-db';
import { getRecentPivots } from '../../trading/pivot-detector';
import { analyzeVolatility, VolatilityResult } from '../../trading/volatility-calculator';
import { aggregateByInterval, INTERVAL_MINUTES } from '../../trading/kline-aggregator';
import { calculateRSI } from '../../skills/tools/analysis-tools';

/**
 * GridRSIContestant 配置（在 GridConfig 基础上增加 RSI 参数）
 */
export interface GridRSIConfig {
    symbol: string;
    tradeAmount: number;
    gridLevels: number;
    pivotN: number;
    windowDays: number;
    windowCount?: number;
    lookbackType?: 'days' | 'count';
    volatilityMin: number;
    volatilityMax: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    recalcIntervalMinutes: number;
    timeframe: string;
    // RSI 专属配置
    rsiPeriod: number;       // RSI 计算周期，默认 14
    rsiOversold: number;     // RSI 超卖阈值，默认 35 → 放大买入
    rsiOverbought: number;   // RSI 超买阈值，默认 65 → 缩小买入 / 放大卖出
    rsiMaxMultiplier: number;// RSI 超卖时买入最大倍数，默认 1.5
    rsiMinMultiplier: number;// RSI 超买时买入最小倍数，默认 0.5
}

/**
 * 网格状态
 */
interface GridState {
    buyLevels: number[];
    sellLevels: number[];
    buyTriggered: boolean[];
    sellTriggered: boolean[];
    lastCalcTimestamp: number;
    volatility: VolatilityResult | null;
    paused: boolean;
    // RSI 状态
    currentRSI: number;
}

/**
 * GridRSIContestant - 在网格策略基础上，利用 RSI 动态调整单笔下单系数
 *
 * 核心逻辑：
 * 1. 枢轴高低点作为买卖价位（同 GridContestant）
 * 2. 每次重算网格时同步计算 RSI
 * 3. RSI 超卖区 → buyMultiplier > 1（放大买入）
 *    RSI 超买区 → buyMultiplier < 1（缩小买入）
 * 4. 三层风控：硬止损、波动率记录、浮盈保护（同 GridContestant）
 */
export class GridRSIContestant implements Contestant {
    public readonly id: string;
    public readonly name: string;

    private portfolio!: VirtualPortfolio;
    private clock!: IClock;
    private db: MarketDatabase;
    private config: GridRSIConfig;
    private gridState: GridState;
    private initialized: boolean = false;
    private lastBuyTick: number = 0;
    private tickCount: number = 0;
    private logBuffer: any[] = [];

    constructor(
        id: string,
        name: string,
        db: MarketDatabase,
        config: Partial<GridRSIConfig> & { symbol: string }
    ) {
        this.id = id;
        this.name = name;
        this.db = db;

        this.config = {
            symbol: config.symbol,
            tradeAmount:            config.tradeAmount            ?? 2000,
            gridLevels:             config.gridLevels             ?? 3,
            pivotN:                 config.pivotN                 ?? 3,
            windowDays:             config.windowDays             ?? 7,
            windowCount:            config.windowCount            ?? 360,
            lookbackType:           config.lookbackType           ?? 'days',
            volatilityMin:          config.volatilityMin          ?? 2,
            volatilityMax:          config.volatilityMax          ?? 50,
            stopLossPercent:        config.stopLossPercent        ?? 2,
            takeProfitPercent:      config.takeProfitPercent      ?? 4,
            recalcIntervalMinutes:  config.recalcIntervalMinutes  ?? 60,
            timeframe:              config.timeframe              ?? '15m',
            // RSI 专属
            rsiPeriod:              config.rsiPeriod              ?? 14,
            rsiOversold:            config.rsiOversold            ?? 35,
            rsiOverbought:          config.rsiOverbought          ?? 65,
            rsiMaxMultiplier:       config.rsiMaxMultiplier       ?? 1.5,
            rsiMinMultiplier:       config.rsiMinMultiplier       ?? 0.5,
        };

        this.gridState = {
            buyLevels: [],
            sellLevels: [],
            buyTriggered: [],
            sellTriggered: [],
            lastCalcTimestamp: 0,
            volatility: null,
            paused: false,
            currentRSI: 50,
        };
    }

    async initialize(initialCapital: number, clock: IClock): Promise<void> {
        this.clock = clock;
        this.portfolio = new VirtualPortfolio(initialCapital, clock);

        if (!this.config.tradeAmount || this.config.tradeAmount === 2000) {
            this.config.tradeAmount = initialCapital / this.config.gridLevels;
        }

        this.initialized = true;
        this.log(`🚀 GridRSI 初始化 | 资金: $${initialCapital} | RSI周期: ${this.config.rsiPeriod} | 超卖: ${this.config.rsiOversold} / 超买: ${this.config.rsiOverbought}`);
    }

    async onTick(): Promise<void> {
        if (!this.initialized) return;

        this.tickCount++;
        const now = this.clock.now();

        const currentPrice = await this.getCurrentPrice(now);
        if (currentPrice === null) return;

        if (this.gridState.paused) {
            this.portfolio.updatePrice(this.config.symbol, currentPrice);
            this.portfolio.takeSnapshot();
            return;
        }

        this.portfolio.updatePrice(this.config.symbol, currentPrice);

        // 判断是否需要重算网格
        const allBuyTriggered  = this.gridState.buyTriggered.length  > 0 && this.gridState.buyTriggered.every(t => t);
        const allSellTriggered = this.gridState.sellTriggered.length > 0 && this.gridState.sellTriggered.every(t => t);
        const needsInit        = this.gridState.buyLevels.length === 0 && this.gridState.sellLevels.length === 0;
        const timeSinceLastCalc = (now - this.gridState.lastCalcTimestamp) / (60 * 1000);
        const timerTriggered    = timeSinceLastCalc >= this.config.recalcIntervalMinutes;

        let deviationTriggered = false;
        if (!needsInit) {
            const minBuy  = this.gridState.buyLevels[0];
            const maxSell = this.gridState.sellLevels[this.gridState.sellLevels.length - 1];
            if (currentPrice < minBuy * 0.98 || currentPrice > maxSell * 1.02) {
                deviationTriggered = true;
            }
        }

        if (needsInit || allBuyTriggered || allSellTriggered || timerTriggered || deviationTriggered) {
            const reason = needsInit           ? '初始化'
                : allBuyTriggered  ? '所有买入点已触发'
                : allSellTriggered ? '所有卖出点已触发'
                : timerTriggered   ? `达到 ${this.config.recalcIntervalMinutes}m 重算间隔`
                :                   '价格偏离原网格过大';
            this.log(`🔄 触发网格刷新（${reason}）`);
            await this.recalculateGrid(now);
        }

        if (this.gridState.buyLevels.length === 0 && this.gridState.sellLevels.length === 0) return;

        if (this.checkStopLoss(currentPrice)) return;
        if (this.checkTakeProfit(currentPrice)) return;

        this.checkBuySignals(currentPrice);
        this.checkSellSignals(currentPrice);

        this.portfolio.takeSnapshot();
    }

    // =========================================================
    // RSI 计算
    // =========================================================

    /**
     * 根据当前 RSI 计算买入系数
     * RSI <= rsiOversold  → rsiMaxMultiplier（最大放大）
     * RSI >= rsiOverbought → rsiMinMultiplier（最大缩小）
     * 中间线性插值
     */
    private getBuyMultiplier(): number {
        const { currentRSI } = this.gridState;
        const { rsiOversold, rsiOverbought, rsiMaxMultiplier, rsiMinMultiplier } = this.config;

        if (currentRSI <= rsiOversold)  return rsiMaxMultiplier;
        if (currentRSI >= rsiOverbought) return rsiMinMultiplier;

        // 线性插值
        const ratio = (currentRSI - rsiOversold) / (rsiOverbought - rsiOversold);
        return rsiMaxMultiplier - ratio * (rsiMaxMultiplier - rsiMinMultiplier);
    }

    // =========================================================
    // 网格重算（加入 RSI 计算）
    // =========================================================

    private async recalculateGrid(now: number): Promise<void> {
        let startTime: Date;
        let limit: number = 50000;

        if (this.config.lookbackType === 'count' && this.config.windowCount) {
            const intervalMinutes = (INTERVAL_MINUTES as any)[this.config.timeframe] || 15;
            const totalMinutes = this.config.windowCount * intervalMinutes;
            startTime = new Date(now - totalMinutes * 60 * 1000);
            limit = Math.max(limit, totalMinutes + 1000);
        } else {
            const windowMs = (this.config.windowDays || 7) * 24 * 60 * 60 * 1000;
            startTime = new Date(now - windowMs);
        }

        const klines = await this.db.queryKlines({
            symbol:   this.config.symbol,
            interval: '1m',
            start:    startTime,
            end:      new Date(now),
            limit,
        });

        if (klines.length < 2 * this.config.pivotN + 1) {
            this.log(`⚠️ K线数据不足（${klines.length} 根），无法计算枢轴点`);
            return;
        }

        klines.sort((a, b) => a.timestamp - b.timestamp);

        const timeframe = (this.config.timeframe as any) || '15m';
        const aggregatedKlines = aggregateByInterval(klines, timeframe);

        if (aggregatedKlines.length < 2 * this.config.pivotN + 1) {
            this.log(`⚠️ 聚合后K线数据不足（${aggregatedKlines.length} 根 ${timeframe}）`);
            return;
        }

        // ---- 计算 RSI ----
        const closePrices = aggregatedKlines.map(k => k.close);
        this.gridState.currentRSI = calculateRSI(closePrices, this.config.rsiPeriod);

        const rsiLabel = this.gridState.currentRSI <= this.config.rsiOversold  ? '🟢超卖'
                       : this.gridState.currentRSI >= this.config.rsiOverbought ? '🔴超买'
                       : '⚪中性';
        this.log(`📊 RSI(${this.config.rsiPeriod}) = ${this.gridState.currentRSI.toFixed(1)} ${rsiLabel} | 买入系数: x${this.getBuyMultiplier().toFixed(2)}`);

        // ---- 波动率 ----
        const volResult = analyzeVolatility(aggregatedKlines, this.config.volatilityMin, this.config.volatilityMax);
        this.gridState.volatility = volResult;
        this.gridState.paused = false;

        if (!volResult.inRange) {
            this.log(`📈 波动率 ${volResult.volatility.toFixed(2)}% 超出理想范围，但继续交易`);
        }

        // ---- 枢轴点 ----
        const currentPrice = aggregatedKlines[aggregatedKlines.length - 1].close;
        const pivots = getRecentPivots(aggregatedKlines, this.config.pivotN, this.config.gridLevels, currentPrice);

        let validBuyLevels  = pivots.lows.filter(p  => p  < currentPrice * 0.999);
        let validSellLevels = pivots.highs.filter(p => p  > currentPrice * 1.001);

        const buySpacing  = 0.015;
        const sellSpacing = 0.025;

        while (validBuyLevels.length < this.config.gridLevels) {
            const base = validBuyLevels.length > 0 ? validBuyLevels[0] : currentPrice;
            validBuyLevels.unshift(base * (1 - buySpacing));
        }

        while (validSellLevels.length < this.config.gridLevels) {
            const base = validSellLevels.length > 0
                ? validSellLevels[validSellLevels.length - 1]
                : currentPrice;
            validSellLevels.push(base * (1 + sellSpacing));
        }

        validBuyLevels  = validBuyLevels.slice(-this.config.gridLevels);
        validSellLevels = validSellLevels.slice(0, this.config.gridLevels);

        this.gridState.buyLevels       = validBuyLevels;
        this.gridState.sellLevels      = validSellLevels;
        this.gridState.buyTriggered    = new Array(validBuyLevels.length).fill(false);
        this.gridState.sellTriggered   = new Array(validSellLevels.length).fill(false);
        this.gridState.lastCalcTimestamp = now;

        this.log(`🔄 网格重算完成 | 当前价: $${currentPrice.toFixed(0)} | 买: [${validBuyLevels.map(p => p.toFixed(0)).join(', ')}] | 卖: [${validSellLevels.map(p => p.toFixed(0)).join(', ')}]`);
    }

    // =========================================================
    // 买卖检查（买入时应用 RSI 系数）
    // =========================================================

    private checkBuySignals(currentPrice: number): void {
        for (let i = 0; i < this.gridState.buyLevels.length; i++) {
            if (this.gridState.buyTriggered[i]) continue;

            const buyLevel = this.gridState.buyLevels[i];
            if (currentPrice <= buyLevel) {
                if (this.tickCount - this.lastBuyTick < 3) continue;

                const overview  = this.portfolio.getOverview();
                const balance   = overview.balance;
                const baseAmount = balance / this.config.gridLevels;

                // 应用 RSI 系数
                const multiplier  = this.getBuyMultiplier();
                const tradeAmount = Math.min(baseAmount * multiplier, balance * 0.95);

                if (tradeAmount < 10) {
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
                    `网格买入 L${i + 1}（触发: ${buyLevel.toFixed(0)}, 实际: ${currentPrice.toFixed(0)}, RSI系数: x${multiplier.toFixed(2)}）`
                );

                if (success) {
                    this.gridState.buyTriggered[i] = true;
                    this.lastBuyTick = this.tickCount;
                    this.log(`✅ 买入 L${i + 1} | $${currentPrice.toFixed(0)} | $${tradeAmount.toFixed(0)} (x${multiplier.toFixed(2)}) | RSI: ${this.gridState.currentRSI.toFixed(1)}`);
                } else {
                    this.gridState.buyTriggered[i] = true;
                    this.log(`❌ 买入 L${i + 1} 失败`);
                }
            }
        }
    }

    private checkSellSignals(currentPrice: number): void {
        for (let i = 0; i < this.gridState.sellLevels.length; i++) {
            if (this.gridState.sellTriggered[i]) continue;

            const sellLevel = this.gridState.sellLevels[i];
            if (currentPrice >= sellLevel) {
                const overview  = this.portfolio.getOverview();
                const position  = overview.positions.find((p: any) => p.symbol === this.config.symbol);
                const totalQty  = position ? position.quantity : 0;

                if (totalQty * currentPrice < 10) continue;

                const sellQty   = totalQty / this.config.gridLevels;
                const sellValue = sellQty * currentPrice;

                const success = this.portfolio.executeTrade(
                    this.config.symbol,
                    'SELL',
                    currentPrice,
                    sellQty,
                    `网格卖出 H${i + 1}（触发: ${sellLevel.toFixed(0)}, 实际: ${currentPrice.toFixed(0)}）`
                );

                if (success) {
                    this.gridState.sellTriggered[i] = true;
                    this.log(`✅ 卖出 H${i + 1} | $${currentPrice.toFixed(0)} | ${sellQty.toFixed(4)} ($${sellValue.toFixed(0)})`);
                } else {
                    this.log(`❌ 卖出 H${i + 1} 失败`);
                }
            }
        }
    }

    // =========================================================
    // 风控
    // =========================================================

    private checkStopLoss(currentPrice: number): boolean {
        if (this.gridState.buyLevels.length === 0) return false;

        const lowestBuy    = this.gridState.buyLevels[0];
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
                    `🔴 硬止损触发`
                );
                this.log(`🔴 硬止损！全仓清出 | $${currentPrice.toFixed(0)} < $${stopLossPrice.toFixed(0)}`);
                this.gridState.paused = true;
            }
            return true;
        }
        return false;
    }

    private checkTakeProfit(currentPrice: number): boolean {
        const overview = this.portfolio.getOverview();
        const position = overview.positions.find((p: any) => p.symbol === this.config.symbol);

        if (!position || position.quantity <= 0) return false;

        const profitPercent = ((currentPrice - position.avgPrice) / position.avgPrice) * 100;

        if (profitPercent >= this.config.takeProfitPercent) {
            const sellQuantity = position.quantity * 0.5;
            this.portfolio.executeTrade(
                this.config.symbol,
                'SELL',
                currentPrice,
                sellQuantity,
                `🟢 浮盈保护（${profitPercent.toFixed(1)}%）`
            );
            this.log(`🟢 浮盈保护触发 | +${profitPercent.toFixed(1)}% | 卖出50%仓位 @ $${currentPrice.toFixed(0)}`);
            return true;
        }
        return false;
    }

    // =========================================================
    // 工具
    // =========================================================

    private async getCurrentPrice(now: number): Promise<number | null> {
        const klines = await this.db.queryKlines({
            symbol:   this.config.symbol,
            interval: '1m',
            end:      new Date(now),
            limit:    1
        });
        if (klines.length === 0) return null;
        return klines[0].close;
    }

    private log(message: string): void {
        const timestamp = new Date(this.clock.now()).toISOString();
        console.log(`[GridRSI:${this.name}] ${message}`);
        this.logBuffer.push({ timestamp: this.clock.now(), message: `[GridRSI] ${message}`, time: timestamp });
    }

    // =========================================================
    // Contestant 接口
    // =========================================================

    getPortfolio(): VirtualPortfolio { return this.portfolio; }

    getLogs(): any[] {
        const logs = [...this.logBuffer];
        this.logBuffer = [];
        return logs;
    }

    getTrades(startIndex: number = 0): any[] {
        return this.portfolio.getTradesIncremental(startIndex).map((t: any) => ({
            ...t,
            createdAt: new Date(t.timestamp),
            total: t.totalUsdt,
        }) as any);
    }

    getMetrics(): any { return this.portfolio.getOverviewBasic(); }
}
