import { Contestant } from '../../core/contestant';
import { IClock } from '../../core/clock';
import { VirtualPortfolio } from '../../trading/portfolio';
import { MarketDatabase } from '../../data/market-db';
import { MiniMaxClient } from '../../core/minimax';

export const DEFAULT_LLM_SYSTEM_PROMPT = `你是一个顶尖的加密货币量化交易员。你的目标是最大化账户净值。
你将获得过去一段时间的价格数据和当前的账户持仓情况。
请根据趋势、波动和你的直觉做出决策。

你必须以 JSON 格式回复，包含以下字段：
- decision: "BUY" | "SELL" | "WAIT"
- percentage: 0.0 到 1.0 之间的浮点数 (决定投入剩余资金的百分比或卖出当前持仓的百分比)
- reasoning: 你的思考过程和理由
- confidence: 0 到 100 之间的置信度分数`;

export class LLMSoloContestant implements Contestant {
    public readonly id: string;
    public readonly name: string;

    private portfolio!: VirtualPortfolio;
    private clock!: IClock;
    private db: MarketDatabase;
    private minimax: MiniMaxClient;
    private symbol: string;
    private customSystemPrompt?: string;

    constructor(
        id: string,
        name: string,
        db: MarketDatabase,
        minimax: MiniMaxClient,
        symbol: string,
        customSystemPrompt?: string
    ) {
        this.id = id;
        this.name = name;
        this.db = db;
        this.minimax = minimax;
        this.symbol = symbol;
        this.customSystemPrompt = customSystemPrompt;
    }

    async initialize(initialCapital: number, clock: IClock): Promise<void> {
        this.clock = clock;
        this.portfolio = new VirtualPortfolio(initialCapital, clock);
    }

    private logs: any[] = [];

    async onTick(): Promise<void> {
        const now = this.clock.now();
        this.logs = []; // 清空上一次决策日志

        // --- 1. 鲁棒的数据获取与自适应视野 ---
        // 考虑到数据库可能只有 1m 数据，我们统一获取最近 1440 根 1m 线（覆盖 24 小时）
        const allKlines = await this.db.queryKlines({
            symbol: this.symbol,
            interval: '1m',
            end: new Date(now),
            limit: 1440
        });

        if (allKlines.length === 0) return;

        // 当前价格（最后一根 K 线的收盘价）
        const currentPrice = allKlines[allKlines.length - 1].close;

        // --- 2. 宏观视野抽样 (将 1m 数据抽样为 1h) ---
        // 每 60 根抽一根，形成最近 24 小时的小时级趋势，节省 Token 且视野宏观
        const macroKlines: any[] = [];
        for (let i = allKlines.length - 1; i >= 0; i -= 60) {
            macroKlines.unshift(allKlines[i]);
            if (macroKlines.length >= 24) break;
        }

        // --- 3. 获取 24 小时汇总指标 ---
        const firstPrice = allKlines[0].open;
        const lastPrice = allKlines[allKlines.length - 1].close;
        const macroContext = {
            change24h: ((lastPrice - firstPrice) / firstPrice) * 100,
            high24h: Math.max(...allKlines.map(k => k.high)),
            low24h: Math.min(...allKlines.map(k => k.low)),
            volume24h: allKlines.reduce((sum, k) => sum + k.volume, 0)
        };

        // 4. 构建提示词
        const portfolioState = this.portfolio.getOverview();
        const prompt = this.buildPrompt(macroKlines, portfolioState, macroContext);

        try {
            const response = await this.minimax.chat(prompt, this.buildSystemPrompt());
            await this.executeDecision(response, currentPrice);
        } catch (error: any) {
            console.error(`[LLMSolo] ${this.name} LLM Error:`, error);
            this.logs.push({
                type: 'error',
                message: error.message,
                timestamp: now
            });
        }

        // 记录快照
        this.portfolio.takeSnapshot();
    }

    getLogs(): any[] {
        return this.logs;
    }

    private buildSystemPrompt(): string {
        let basePrompt = this.customSystemPrompt || DEFAULT_LLM_SYSTEM_PROMPT;
        return `${basePrompt}\n\n注意：reasoning 字段必须精简，不得超过 100 字。`;
    }

    private buildPrompt(klines: any[], state: any, macro: any): string {
        // 使用压缩的 CSV 格式：T (Time), P (Price), V (Volume)
        const csvHeader = "T(UTC),P,V";
        const csvBody = klines.map(k => {
            const timeStr = new Date(k.timestamp).toISOString().replace(/T/, ' ').slice(5, 16); // "MM-DD HH:mm"
            return `${timeStr},${Math.round(k.close)},${Math.round(k.volume)}`;
        }).join('\n');

        const position = state.positions.find((p: any) => p.symbol === this.symbol) || { quantity: 0, avgPrice: 0 };

        return `【${this.symbol} 24h】
涨跌: ${macro.change24h.toFixed(1)}%, 高: ${macro.high24h}, 低: ${macro.low24h}, 量: ${Math.round(macro.volume24h)}

【Market Data (CSV)】
${csvHeader}
${csvBody}

【Account】
USDT: ${Math.round(state.balance)}, ${this.symbol}: ${position.quantity.toFixed(4)} (Entry: ${Math.round(position.avgPrice)}), Total: ${Math.round(state.totalEquity)}`;
    }

    private async executeDecision(response: string, currentPrice: number): Promise<void> {
        try {
            // 尝试提取 JSON (LLM 有时会带上 markdown 代码块)
            const jsonStr = response.match(/\{[\s\S]*\}/)?.[0] || response;
            const decisionData = JSON.parse(jsonStr);

            const { decision, percentage, reasoning } = decisionData;

            this.logs.push({
                type: 'decision',
                decision,
                percentage,
                reasoning,
                timestamp: this.clock.now()
            });

            if (decision === 'BUY' && percentage > 0) {
                const amountToSpend = this.portfolio.getOverview().balance * percentage;
                if (amountToSpend > 10) {
                    const quantity = amountToSpend / currentPrice;
                    this.portfolio.executeTrade(this.symbol, 'BUY', currentPrice, quantity, reasoning);
                    console.log(`[LLMSolo] ${this.name} BUY at ${currentPrice}, reasoning: ${reasoning}`);
                }
            } else if (decision === 'SELL' && percentage > 0) {
                const currentPos = this.portfolio.getOverview().positions.find(p => p.symbol === this.symbol);
                if (currentPos && currentPos.quantity > 0) {
                    const quantityToSell = currentPos.quantity * percentage;
                    this.portfolio.executeTrade(this.symbol, 'SELL', currentPrice, quantityToSell, reasoning);
                    console.log(`[LLMSolo] ${this.name} SELL at ${currentPrice}, reasoning: ${reasoning}`);
                }
            } else {
                // console.log(`[LLMSolo] ${this.name} decided to WAIT. Reasoning: ${reasoning}`);
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
}
