import { Contestant } from '../../core/contestant';
import { IClock } from '../../core/clock';
import { VirtualPortfolio } from '../../trading/portfolio';
import { MarketDatabase } from '../../data/market-db';
import { MiniMaxClient } from '../../core/minimax';
import { calculateRSI, calculateSMA, calculateMACD } from '../../skills/tools/analysis-tools';

// ============================================
// 情报等级配置类型定义
// ============================================

export type IntelligenceLevel = 'lite' | 'indicator' | 'strategy' | 'scalper';

export interface LLMSoloConfig {
    /** 情报等级: lite=最少, indicator=带指标, strategy=带策略建议, scalper=高频波段 */
    intelligenceLevel?: IntelligenceLevel;
    /** 自定义系统提示词 */
    customSystemPrompt?: string;
    /** 是否包含日线数据 (Heavy模式) */
    includeDaily?: boolean;
}

// ============================================
// 系统提示词模板
// ============================================

const SYSTEM_PROMPTS: Record<IntelligenceLevel, string> = {
    lite: `你是一个加密货币交易员。基于价格数据做出交易决策。
你必须以 JSON 格式回复：
{
  "decision": "BUY" | "SELL" | "WAIT",
  "percentage": 0.0-1.0,
  "reasoning": "简要理由(50字内)",
  "confidence": 0-100
}`,

    indicator: `你是加密货币交易员。基于价格数据和技术指标判断趋势并做出交易决策。

【你会收到的信息】
1. 当前价格 & 24h 价格走势
2. RSI(14)：衡量价格强弱(0-100)
3. SMA均线(7/25/50)：识别趋势方向
4. MACD：柱状图和金叉/死叉信号
5. 指标历史：24h各指标变化轨迹
6. 账户状态：USDT余额、BTC持仓、总权益

【你的任务】
- 自主分析趋势，决定买/卖/等待
- 自己判断仓位比例(0-100%)
- 目标：盈利最大化

向后兼容：
你必须以 JSON 格式回复：
{
  "decision": "BUY" | "SELL" | "WAIT",
  "percentage": 0.0-1.0,
  "reasoning": "分析逻辑和决策理由(100字内)",
  "confidence": 0-100
}`,

    strategy: `你是首席量化策略师。使用多时间框架分析+结构化推理框架进行波段交易。

【推理框架 - 严格按此步骤思考】
1. 趋势判断(Trend): 综合日线级别和小时线指标，判断当前处于上涨、下跌还是震荡行情。
2. 位置评估(Position): 分析当前价格在 24h 高低点区间及均线系统中的相对位置。
3. 信号确认(Signal): 观察 RSI 是否极端、MACD 是否金叉/死叉、均线是否发生排列变化。
4. 综合决策(Action): 基于以上分析，自主决定买入、卖出或观望，并确定合理的仓位比例。

【交易准则】
- 顺势而为：在明确大趋势中寻找入场点。
- 逆势预判：在指标极度超买/超卖且出现反转信号时进行左侧交易。
- 风险控制：避免在震荡行情中反复割肉。

你必须以 JSON 格式回复：
{
  "decision": "BUY" | "SELL" | "WAIT",
  "percentage": 0.0-1.0,
  "reasoning": "趋势→位置→信号→决策(100字内)",
  "confidence": 0-100,
  "analysis": {
    "trend": "up/down/sideways",
    "position": "low/fair/high",
    "signal_strength": 1-10
  }
}`,

    scalper: `你是高频波段交易员。专注于捕捉小波动，积少成多。

【交易理念】
- 灵活进出：抓住每一个小波段机会，小利即出（2-3% 浮盈即可考虑减仓）
- 逢低吸纳：回调时分批建仓，不追高
- 建议仓位：多采用 25% 分批试探，50% 核心持仓
- 高频交易：保持交易活跃度，积少成多
- 自主决策：根据市场状态自己判断买卖时机和仓位

【你会收到的信息】
1. 当前价格 & 24h 价格走势
2. 技术指标：RSI、SMA、MACD 当前值和历史轨迹
3. 价格相对24h最高/最低的位置
4. 当前持仓状态：成本价、浮盈亏

【自主决策权】
- 买卖时机：你自己判断什么时候买/卖/等待
- 仓位比例：你自己决定每次用多少资金（0-100%）
- 分批策略：你自己决定分几批、每批多少
- 目标：盈利最大化，没有固定规则束缚

【波段范例 (Few-shot)】
- 场景：RSI 突破 70 且价格接近 24h 高点，出现滞涨。
- 决策：{"decision": "SELL", "percentage": 0.5, "reasoning": "RSI 超买且触及阻力位，高频操作止盈半仓锁定利润", "confidence": 90}

【输出格式】
{
  "decision": "BUY" | "SELL" | "WAIT",
  "percentage": 0.0-1.0,
  "reasoning": "分析逻辑和决策理由(100字内)",
  "confidence": 0-100
}`
};

// 默认提示词（保持向后兼容）
export const DEFAULT_LLM_SYSTEM_PROMPT = SYSTEM_PROMPTS.lite;

// ============================================
// LLM 单兵选手实现
// ============================================

export class LLMSoloContestant implements Contestant {
    public readonly id: string;
    public readonly name: string;

    private portfolio!: VirtualPortfolio;
    private clock!: IClock;
    private db: MarketDatabase;
    private minimax: MiniMaxClient;
    private symbol: string;
    private config: Required<LLMSoloConfig>;

    constructor(
        id: string,
        name: string,
        db: MarketDatabase,
        minimax: MiniMaxClient,
        symbol: string,
        config?: LLMSoloConfig | string  // 支持新配置对象或旧版字符串
    ) {
        this.id = id;
        this.name = name;
        this.db = db;
        this.minimax = minimax;
        this.symbol = symbol;

        // 处理向后兼容：如果传入 string，视为 customSystemPrompt
        if (typeof config === 'string') {
            this.config = {
                intelligenceLevel: 'lite',
                customSystemPrompt: config,
                includeDaily: false
            };
        } else {
            this.config = {
                intelligenceLevel: config?.intelligenceLevel ?? 'lite',
                customSystemPrompt: config?.customSystemPrompt ?? '',
                includeDaily: config?.includeDaily ?? false
            };
        }
    }

    async initialize(initialCapital: number, clock: IClock): Promise<void> {
        this.clock = clock;
        this.portfolio = new VirtualPortfolio(initialCapital, clock);
    }

    private logs: any[] = [];

    async onTick(): Promise<void> {
        const now = this.clock.now();
        this.logs = [];

        const level = this.config.intelligenceLevel;
        console.log(`[LLMSolo-${level}:${this.name}] 📊 Tick at ${new Date(now).toISOString()}`);

        // 获取 24h 1m 数据
        const allKlines = await this.db.queryKlines({
            symbol: this.symbol,
            interval: '1m',
            end: new Date(now),
            limit: 1440
        });

        if (allKlines.length === 0) {
            console.log(`[LLMSolo-${level}:${this.name}] ⚠️ 无数据`);
            return;
        }

        const currentPrice = allKlines[allKlines.length - 1].close;

        // 获取仓位信息用于日志
        const portfolioState = this.portfolio.getOverview();
        const position = portfolioState.positions.find((p: any) => p.symbol === this.symbol);
        const btcQty = position ? position.quantity : 0;

        console.log(`[LLMSolo-${level}:${this.name}] 💰 当前价格: $${currentPrice}, K线数: ${allKlines.length}`);
        console.log(`[LLMSolo-${level}:${this.name}] 💼 账户: USDT=${portfolioState.balance.toFixed(2)}, ${this.symbol}=${btcQty.toFixed(4)}, 总权益=${portfolioState.totalEquity.toFixed(2)}`);

        // 记录状态日志
        this.logs.push({
            type: 'status',
            price: currentPrice,
            btcQty: btcQty.toFixed(4),
            usdtBalance: portfolioState.balance.toFixed(2),
            totalEquity: portfolioState.totalEquity.toFixed(2),
            timestamp: now
        });

        const prompt = await this.buildPromptByLevel(allKlines, portfolioState);
        console.log(`[LLMSolo-${level}:${this.name}] 📝 Prompt长度: ${prompt.length} 字符`);
        // DEBUG: 打印前500字符查看结构
        console.log(`[LLMSolo-${level}:${this.name}] 📝 Prompt预览: ${prompt.substring(0, 500)}...`);

        try {
            console.log(`[LLMSolo-${level}:${this.name}] 🤖 调用LLM...`);
            const response = await this.minimax.chat(prompt, this.buildSystemPrompt());
            console.log(`[LLMSolo-${level}:${this.name}] ✅ LLM响应: ${response.substring(0, 200)}...`);
            await this.executeDecision(response, currentPrice, prompt);
        } catch (error: any) {
            console.error(`[LLMSolo-${level}:${this.name}] ❌ LLM Error:`, error);
            this.logs.push({ type: 'error', message: error.message, timestamp: now });
        }

        this.portfolio.takeSnapshot();
    }

    getLogs(): any[] {
        return this.logs;
    }

    // ============================================
    // 提示词构建 - 根据情报等级分发
    // ============================================

    private async buildPromptByLevel(klines: any[], portfolioState: any): Promise<string> {
        const level = this.config.intelligenceLevel;

        switch (level) {
            case 'lite':
                return this.buildLitePrompt(klines, portfolioState);
            case 'indicator':
                return this.buildIndicatorPrompt(klines, portfolioState);
            case 'strategy':
                return this.buildStrategyPrompt(klines, portfolioState);
            case 'scalper':
                return this.buildScalperPrompt(klines, portfolioState);
            default:
                return this.buildLitePrompt(klines, portfolioState);
        }
    }

    /** Lite: 24h K线 + 涨跌汇总 (原有行为) */
    private buildLitePrompt(allKlines: any[], state: any): string {
        // 抽样为 1h
        const macroKlines: any[] = [];
        for (let i = allKlines.length - 1; i >= 0; i -= 60) {
            macroKlines.unshift(allKlines[i]);
            if (macroKlines.length >= 24) break;
        }

        const firstPrice = allKlines[0].open;
        const lastPrice = allKlines[allKlines.length - 1].close;
        const macroContext = {
            change24h: ((lastPrice - firstPrice) / firstPrice) * 100,
            high24h: Math.max(...allKlines.map(k => k.high)),
            low24h: Math.min(...allKlines.map(k => k.low)),
            volume24h: allKlines.reduce((sum, k) => sum + k.volume, 0)
        };

        // CSV 格式
        const csvHeader = "T(UTC),P,V";
        const csvBody = macroKlines.map(k => {
            const timeStr = new Date(k.timestamp).toISOString().replace(/T/, ' ').slice(5, 16);
            return `${timeStr},${Math.round(k.close)},${Math.round(k.volume)}`;
        }).join('\n');

        const position = state.positions.find((p: any) => p.symbol === this.symbol) || { quantity: 0, avgPrice: 0 };

        return `【${this.symbol} 24h】
涨跌: ${macroContext.change24h.toFixed(1)}%, 高: ${macroContext.high24h}, 低: ${macroContext.low24h}, 量: ${Math.round(macroContext.volume24h)}

【Market Data (CSV)】
${csvHeader}
${csvBody}

【Account】
USDT: ${Math.round(state.balance)}, ${this.symbol}: ${position.quantity.toFixed(4)} (Entry: ${Math.round(position.avgPrice)}), Total: ${Math.round(state.totalEquity)}`;
    }

    /** Indicator: Lite的完整数据 + RSI/SMA/MACD 指标（含24h历史） */
    private buildIndicatorPrompt(allKlines: any[], state: any): string {
        // Lite级别的市场概况（完整24h数据）
        const prices = allKlines.map(k => k.close);
        const firstPrice = allKlines[0].open;
        const lastPrice = prices[prices.length - 1];
        const change24h = ((lastPrice - firstPrice) / firstPrice) * 100;
        const high24h = Math.max(...allKlines.map(k => k.high));
        const low24h = Math.min(...allKlines.map(k => k.low));
        const volume24h = allKlines.reduce((sum, k) => sum + k.volume, 0);

        // 抽样24根小时线
        const macroKlines: any[] = [];
        for (let i = allKlines.length - 1; i >= 0; i -= 60) {
            macroKlines.unshift(allKlines[i]);
            if (macroKlines.length >= 24) break;
        }

        // 计算当前指标
        const currentRSI = calculateRSI(prices, 14);
        const currentSMA7 = calculateSMA(prices, 7);
        const currentSMA25 = calculateSMA(prices, 25);
        const currentSMA50 = calculateSMA(prices, 50);
        const currentMACD = calculateMACD(prices);

        // 预计算每根小时线采样点的索引（避免重复 findIndex）
        const sampleIndices: number[] = [];
        for (let i = allKlines.length - 1; i >= 0; i -= 60) {
            sampleIndices.unshift(i);
            if (sampleIndices.length >= 24) break;
        }

        // 一次性计算所有采样点需要的指标值（O(n) 级别）
        // SMA 只需要最后 N 个值，直接在采样点计算即可
        // RSI 使用增量算法，预计算到各采样点
        const indicatorHistory: { time: string; price: number; rsi: number; sma7: number; sma25: number; sma50: number; macdHist: number }[] = [];

        for (const klineIndex of sampleIndices) {
            if (klineIndex < 50) continue; // 数据不足，跳过

            const kline = allKlines[klineIndex];
            const pricesUpToNow = prices.slice(0, klineIndex + 1);
            const timeStr = new Date(kline.timestamp).toISOString().replace(/T/, ' ').slice(5, 16);

            // SMA 只需要最近 N 个值，使用 slice 取尾部即快速
            const sma7Slice = pricesUpToNow.slice(-7);
            const sma25Slice = pricesUpToNow.slice(-25);
            const sma50Slice = pricesUpToNow.slice(-50);

            indicatorHistory.push({
                time: timeStr,
                price: Math.round(kline.close),
                rsi: Math.round(calculateRSI(pricesUpToNow, 14)),
                sma7: Math.round(sma7Slice.reduce((a, b) => a + b, 0) / sma7Slice.length),
                sma25: Math.round(sma25Slice.reduce((a, b) => a + b, 0) / sma25Slice.length),
                sma50: Math.round(sma50Slice.reduce((a, b) => a + b, 0) / sma50Slice.length),
                macdHist: Math.round(calculateMACD(pricesUpToNow).histogram)
            });
        }

        const csvBody = macroKlines.map(k => {
            const timeStr = new Date(k.timestamp).toISOString().replace(/T/, ' ').slice(5, 16);
            return `${timeStr},${Math.round(k.close)},${Math.round(k.volume)}`;
        }).join('\n');

        const indicatorCSV = indicatorHistory.map(h =>
            `${h.time},${h.price},${h.rsi},${h.sma7},${h.sma25},${h.sma50},${h.macdHist}`
        ).join('\n');

        const position = state.positions.find((p: any) => p.symbol === this.symbol) || { quantity: 0, avgPrice: 0 };

        // RSI 状态
        const rsiStatus = currentRSI < 30 ? '超卖' : currentRSI > 70 ? '超买' : '中性';
        // 均线排列
        const maAlignment = currentSMA7 > currentSMA25 && currentSMA25 > currentSMA50 ? '多头排列' :
            currentSMA7 < currentSMA25 && currentSMA25 < currentSMA50 ? '空头排列' : '震荡';
        // MACD 趋势
        const macdStatus = currentMACD.histogram > 0 ? '看多' : '看空';

        return `【${this.symbol} 24h】
涨跌: ${change24h.toFixed(1)}%, 高: ${Math.round(high24h)}, 低: ${Math.round(low24h)}, 量: ${Math.round(volume24h)}

【当前技术指标】
RSI(14): ${Math.round(currentRSI)} (${rsiStatus})
SMA: 7=${Math.round(currentSMA7)}, 25=${Math.round(currentSMA25)}, 50=${Math.round(currentSMA50)} (${maAlignment})
MACD: ${macdStatus} (柱状${currentMACD.histogram > 0 ? '+' : ''}${Math.round(currentMACD.histogram)})

【价格数据 (CSV)】
T(UTC),P,V
${csvBody}

【指标历史 (CSV)】
T(UTC),P,RSI,SMA7,SMA25,SMA50,MACD_H
${indicatorCSV}

【Account】
USDT: ${Math.round(state.balance)}, ${this.symbol}: ${position.quantity.toFixed(4)} (Entry: ${Math.round(position.avgPrice)}), Total: ${Math.round(state.totalEquity)}`;
    }

    /** Strategy: Indicator + 日线数据 + 策略建议 */
    private async buildStrategyPrompt(allKlines: any[], state: any): Promise<string> {
        const prices = allKlines.map(k => k.close);
        const currentPrice = prices[prices.length - 1];

        // 小时线指标
        const rsi = calculateRSI(prices, 14);
        const sma7 = calculateSMA(prices, 7);
        const sma25 = calculateSMA(prices, 25);
        const sma50 = calculateSMA(prices, 50);
        const macd = calculateMACD(prices);

        const firstPrice = allKlines[0].open;
        const change24h = ((currentPrice - firstPrice) / firstPrice) * 100;

        // 抽样 K线（12h，减少 Token）
        const macroKlines: any[] = [];
        for (let i = allKlines.length - 1; i >= 0; i -= 120) {
            macroKlines.unshift(allKlines[i]);
            if (macroKlines.length >= 12) break;
        }

        const csvBody = macroKlines.map(k => {
            const timeStr = new Date(k.timestamp).toISOString().replace(/T/, ' ').slice(5, 16);
            return `${timeStr},${Math.round(k.close)}`;
        }).join('\n');

        // 策略信号计算
        let signalScore = 5; // 0-10
        const signals: string[] = [];

        // RSI 信号
        if (rsi < 30) { signalScore += 2; signals.push('RSI超卖'); }
        else if (rsi < 40) { signalScore += 1; signals.push('RSI偏低'); }
        else if (rsi > 70) { signalScore -= 2; signals.push('RSI超买'); }
        else if (rsi > 60) { signalScore -= 1; signals.push('RSI偏高'); }

        // 均线信号
        if (sma7 > sma25 && sma25 > sma50) { signalScore += 1; signals.push('均线多头排列'); }
        else if (sma7 < sma25 && sma25 < sma50) { signalScore -= 1; signals.push('均线空头排列'); }

        // MACD 信号
        if (macd.trend === 'bullish') { signalScore += 1; signals.push('MACD金叉'); }
        else if (macd.trend === 'bearish') { signalScore -= 1; signals.push('MACD死叉'); }
        else if (macd.histogram > 0) { signalScore += 0.5; }
        else { signalScore -= 0.5; }

        // 生成策略建议
        let strategyAdvice: string;
        let strength: number;
        if (signalScore >= 8) { strategyAdvice = '强烈买入'; strength = Math.min(10, Math.round(signalScore)); }
        else if (signalScore >= 6) { strategyAdvice = '买入'; strength = Math.round(signalScore); }
        else if (signalScore <= 2) { strategyAdvice = '强烈卖出'; strength = Math.min(10, Math.round(10 - signalScore)); }
        else if (signalScore <= 4) { strategyAdvice = '卖出'; strength = Math.round(10 - signalScore); }
        else { strategyAdvice = '观望'; strength = 5; }

        const position = state.positions.find((p: any) => p.symbol === this.symbol) || { quantity: 0, avgPrice: 0 };

        // 日线数据（如启用）
        let dailySection = '';
        if (this.config.includeDaily) {
            const dailyMap = new Map<string, number>();
            for (const k of allKlines) {
                const day = new Date(k.timestamp).toISOString().slice(0, 10);
                dailyMap.set(day, k.close);
            }
            const dayPrices = Array.from(dailyMap.values());
            if (dayPrices.length >= 5) {
                const daySMA5 = calculateSMA(dayPrices, Math.min(5, dayPrices.length));
                const dayTrend = currentPrice > daySMA5 ? '日线级别向上' : '日线级别向下';
                dailySection = `\n【日线视角】${dayTrend} (5日均: ${Math.round(daySMA5)})\n`;
            }
        }

        return `【${this.symbol} 多时间框架分析】
当前价: ${Math.round(currentPrice)} | 24h: ${change24h > 0 ? '+' : ''}${change24h.toFixed(1)}%

【小时线技术指标】
RSI(14): ${Math.round(rsi)}/100 | SMA: ${Math.round(sma7)}/${Math.round(sma25)}/${Math.round(sma50)} | MACD: ${Math.round(macd.histogram)}

【近12h价格序列】
${csvBody}
${dailySection}
【策略信号】
触发条件: ${signals.join(', ') || '无明显信号'}
综合评分: ${Math.round(signalScore)}/10 → ${strategyAdvice}(强度${strength}/10)

【账户状态】
USDT: ${Math.round(state.balance)} | ${this.symbol}: ${position.quantity.toFixed(4)} | 总权益: ${Math.round(state.totalEquity)}`;
    }

    /** Scalper: 高频波段策略，使用Indicator的数据输入 + Scalper的交易理念 */
    private buildScalperPrompt(allKlines: any[], state: any): string {
        // ========== Indicator 的数据输入部分 ==========
        const prices = allKlines.map(k => k.close);
        const firstPrice = allKlines[0].open;
        const lastPrice = prices[prices.length - 1];
        const change24h = ((lastPrice - firstPrice) / firstPrice) * 100;
        const high24h = Math.max(...allKlines.map(k => k.high));
        const low24h = Math.min(...allKlines.map(k => k.low));
        const volume24h = allKlines.reduce((sum, k) => sum + k.volume, 0);

        // 抽样24根小时线
        const macroKlines: any[] = [];
        for (let i = allKlines.length - 1; i >= 0; i -= 60) {
            macroKlines.unshift(allKlines[i]);
            if (macroKlines.length >= 24) break;
        }

        // 计算当前指标
        const currentRSI = calculateRSI(prices, 14);
        const currentSMA7 = calculateSMA(prices, 7);
        const currentSMA25 = calculateSMA(prices, 25);
        const currentSMA50 = calculateSMA(prices, 50);
        const currentMACD = calculateMACD(prices);

        // 预计算每根小时线采样点的索引
        const sampleIndices: number[] = [];
        for (let i = allKlines.length - 1; i >= 0; i -= 60) {
            sampleIndices.unshift(i);
            if (sampleIndices.length >= 24) break;
        }

        // 24h 指标历史
        const indicatorHistory: { time: string; price: number; rsi: number; sma7: number; sma25: number; sma50: number; macdHist: number }[] = [];
        for (const klineIndex of sampleIndices) {
            if (klineIndex < 50) continue;
            const kline = allKlines[klineIndex];
            const pricesUpToNow = prices.slice(0, klineIndex + 1);
            const timeStr = new Date(kline.timestamp).toISOString().replace(/T/, ' ').slice(5, 16);
            const sma7Slice = pricesUpToNow.slice(-7);
            const sma25Slice = pricesUpToNow.slice(-25);
            const sma50Slice = pricesUpToNow.slice(-50);
            indicatorHistory.push({
                time: timeStr,
                price: Math.round(kline.close),
                rsi: Math.round(calculateRSI(pricesUpToNow, 14)),
                sma7: Math.round(sma7Slice.reduce((a, b) => a + b, 0) / sma7Slice.length),
                sma25: Math.round(sma25Slice.reduce((a, b) => a + b, 0) / sma25Slice.length),
                sma50: Math.round(sma50Slice.reduce((a, b) => a + b, 0) / sma50Slice.length),
                macdHist: Math.round(calculateMACD(pricesUpToNow).histogram)
            });
        }

        const csvBody = macroKlines.map(k => {
            const timeStr = new Date(k.timestamp).toISOString().replace(/T/, ' ').slice(5, 16);
            return `${timeStr},${Math.round(k.close)},${Math.round(k.volume)}`;
        }).join('\n');

        const indicatorCSV = indicatorHistory.map(h =>
            `${h.time},${h.price},${h.rsi},${h.sma7},${h.sma25},${h.sma50},${h.macdHist}`
        ).join('\n');

        // ========== Scalper 的持仓和交易建议部分 ==========
        const position = state.positions.find((p: any) => p.symbol === this.symbol) || { quantity: 0, avgPrice: 0 };
        const holdingCost = position.avgPrice;
        const currentPrice = lastPrice;
        const unrealizedPnl = holdingCost > 0 ? ((currentPrice - holdingCost) / holdingCost) * 100 : 0;

        // 当前位置（0-100%，相对24h范围）
        const positionInRange = ((currentPrice - low24h) / (high24h - low24h)) * 100;

        return `【${this.symbol} 波段交易分析】
当前价: ${Math.round(currentPrice)} | 24h涨跌: ${change24h.toFixed(1)}%
24h区间: ${Math.round(low24h)} - ${Math.round(high24h)} | 当前位置: ${positionInRange.toFixed(1)}%

【当前技术指标】
RSI(14): ${Math.round(currentRSI)} | SMA: ${Math.round(currentSMA7)}/${Math.round(currentSMA25)}/${Math.round(currentSMA50)}
MACD: ${Math.round(currentMACD.histogram)}

【价格数据 (CSV)】
T(UTC),P,V
${csvBody}

【指标历史 (CSV)】
T(UTC),P,RSI,SMA7,SMA25,SMA50,MACD_H
${indicatorCSV}

【持仓状态】
${this.symbol}: ${position.quantity.toFixed(4)} | 成本: ${Math.round(holdingCost)} | 浮盈: ${unrealizedPnl > 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}%
USDT: ${Math.round(state.balance)} | 总权益: ${Math.round(state.totalEquity)}

【分析角度参考】（供你自主判断）
- 浮盈状态：当前盈利还是亏损？幅度多大？
- 价格位置：相对24h高低点处于什么位置？
- 指标状态：RSI是否极端？均线排列如何？MACD趋势？
- 波动机会：近期波动幅度是否提供交易空间？
- 你自己决定：买/卖/等待、仓位大小、分批策略`;
    }

    private buildSystemPrompt(): string {
        // 优先使用自定义提示词
        if (this.config.customSystemPrompt) {
            return `${this.config.customSystemPrompt}\n\n注意：reasoning 字段必须精简，不得超过 100 字。`;
        }

        const level = this.config.intelligenceLevel;
        return SYSTEM_PROMPTS[level] || SYSTEM_PROMPTS.lite;
    }

    // ============================================
    // 交易执行
    // ============================================

    private async executeDecision(response: string, currentPrice: number, prompt: string): Promise<void> {
        try {
            const jsonStr = response.match(/\{[\s\S]*\}/)?.[0] || response;
            const decisionData = JSON.parse(jsonStr);

            const { decision, percentage, reasoning, confidence } = decisionData;

            // 获取当前仓位信息
            const portfolioState = this.portfolio.getOverview();
            const position = portfolioState.positions.find((p: any) => p.symbol === this.symbol);
            const btcQty = position ? position.quantity : 0;
            const usdtBalance = portfolioState.balance;

            this.logs.push({
                type: 'decision',
                decision,
                percentage,
                reasoning,
                confidence,
                price: currentPrice,
                btcQty: btcQty.toFixed(4),
                usdtBalance: usdtBalance.toFixed(2),
                totalEquity: portfolioState.totalEquity.toFixed(2),
                prompt: prompt.substring(0, 1000), // 限制prompt长度
                llmResponse: response,
                timestamp: this.clock.now()
            });

            if (decision === 'BUY' && percentage > 0) {
                const amountToSpend = this.portfolio.getOverview().balance * percentage;
                if (amountToSpend > 10) {
                    const quantity = amountToSpend / currentPrice;
                    this.portfolio.executeTrade(this.symbol, 'BUY', currentPrice, quantity, reasoning);
                    console.log(`[LLMSolo-${this.config.intelligenceLevel}] ${this.name} BUY at ${currentPrice}, reasoning: ${reasoning}`);
                }
            } else if (decision === 'SELL' && percentage > 0) {
                const currentPos = this.portfolio.getOverview().positions.find(p => p.symbol === this.symbol);
                if (currentPos && currentPos.quantity > 0) {
                    const quantityToSell = currentPos.quantity * percentage;
                    this.portfolio.executeTrade(this.symbol, 'SELL', currentPrice, quantityToSell, reasoning);
                    console.log(`[LLMSolo-${this.config.intelligenceLevel}] ${this.name} SELL at ${currentPrice}, reasoning: ${reasoning}`);
                }
            }
        } catch (e) {
            console.warn(`[LLMSolo] Failed to parse LLM response: ${response}`);
            this.logs.push({
                type: 'error',
                message: 'Failed to parse LLM response',
                raw: response,
                timestamp: this.clock.now()
            });
        }
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

    // 获取配置（用于调试）
    getConfig(): LLMSoloConfig {
        return { ...this.config };
    }
}
