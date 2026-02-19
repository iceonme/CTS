import { Contestant } from '../../core/contestant';
import { IClock } from '../../core/clock';
import { VirtualPortfolio } from '../../trading/portfolio';
import { TechnicalAnalyst } from '../tech-analyst';
import { PA } from '../pa';
import { MarketDatabase } from '../../data/market-db';

/**
 * MASContestant - 多智能体小队参赛者
 * 
 * 集成 TechnicalAnalyst 和 PA，模拟真实的协作交易流程。
 */
export class MASContestant implements Contestant {
    public readonly id: string;
    public readonly name: string;

    private portfolio!: VirtualPortfolio;
    private clock!: IClock;
    private techAnalyst!: TechnicalAnalyst;
    private pa!: PA;

    private symbol: string;
    private db: MarketDatabase;

    constructor(id: string, name: string, db: MarketDatabase, symbol: string) {
        this.id = id;
        this.name = name;
        this.db = db;
        this.symbol = symbol;
    }

    async initialize(initialCapital: number, clock: IClock): Promise<void> {
        this.clock = clock;
        this.portfolio = new VirtualPortfolio(initialCapital, clock);

        // 初始化 Agent 并注入同一时钟
        this.techAnalyst = new TechnicalAnalyst({ identity: { id: `${this.id}-tech`, name: 'MAS Tech', role: 'Technical Analyst', personality: '', background: '' } }, clock);
        this.pa = new PA({ identity: { id: `${this.id}-pa`, name: 'MAS PA', role: 'Squad Leader', personality: '', background: '' } }, clock);

        // 配置 PA：自动执行决策以便在回测中自动下单
        this.pa.setAutoExecute(true);
        this.pa.setConfidenceThreshold(70);

        // 覆盖 PA 的执行逻辑：对接 VirtualPortfolio
        // 注入自定义的 set_target_position skill
        this.setupTradingSkills();

        console.log(`[MASContestant] ${this.name} initialized with initial capital: ${initialCapital}`);
    }

    private setupTradingSkills(): void {
        // 为 PA 注册一个专门针对此向比赛的 set_target_position Skill
        // 这里简单通过覆盖 BaseAgent 的 executeSkill 来拦截（或者正式注册一个新 Skill）
        // 为了演示例程简单，我们直接重写 PA 的 executeDecision
        const originalExecute = this.pa.executeDecision.bind(this.pa);
        this.pa.executeDecision = async (decision) => {
            if (decision.tool_call.function === 'set_target_position') {
                const { symbol, target_percent, reason } = decision.tool_call.args;

                // 1. 获取当前行情价
                const klines = await this.db.queryKlines({
                    symbol,
                    interval: '1m',
                    end: this.clock.date(),
                    limit: 1
                });

                if (klines.length > 0) {
                    const price = klines[0].close;
                    this.portfolio.updatePrice(symbol, price);

                    const totalEquity = this.portfolio.getTotalEquity();
                    const targetValue = totalEquity * target_percent;

                    // 简化逻辑：只处理买入到目标值（假设目前是空仓）
                    // 在实际系统中，这需要对比当前持仓算出买卖差额
                    const currentPos = this.portfolio.getOverview().positions.find(p => p.symbol === symbol);
                    const currentVal = currentPos ? currentPos.quantity * price : 0;
                    const diffVal = targetValue - currentVal;

                    if (diffVal > 10) { // 买入
                        const qty = diffVal / price;
                        this.portfolio.executeTrade(symbol, 'BUY', price, qty, reason);
                        console.log(`[MAS] PA executed BUY for ${symbol} at ${price}, qty: ${qty}`);
                    } else if (diffVal < -10) { // 卖出
                        const qty = Math.abs(diffVal) / price;
                        this.portfolio.executeTrade(symbol, 'SELL', price, qty, reason);
                        console.log(`[MAS] PA executed SELL for ${symbol} at ${price}, qty: ${qty}`);
                    }
                }
            }
            return originalExecute(decision);
        };
    }

    async onTick(): Promise<void> {
        const now = this.clock.now();

        // 1. 每 5 分钟触发一次技术分析 (虚拟模拟)
        // 注意：当前代码中 TechnicalAnalyst 是通过订阅 FeedBus 自动运行的
        // ReplayEngine 曾负责发 feed，但现在我们改成了“拉模式”或者显式驱动

        // 为了兼容现有逻辑，我们可以在每个 tick 时，如果满足时间条件，就手动触发一个行情 Feed
        // 这里体现了 RaceController 驱动 onTick 的灵活性

        // 每 5 分钟 (300,000 ms) 触发一次分析
        if (now % (5 * 60 * 1000) === 0) {
            // 由于我们在 ADR-003 中决定 FeedBus 仅用于 Agent 观点共享，
            // 原始行情不走 FeedBus，但 TechnicalAnalyst 仍监听 FeedBus 或显式分析。
            // 目前 TechnicalAnalyst.onFeed 监听 'market-replay' 来源的 'signal'。
            // 我们改写成直接调用分析：
            const klines = await this.db.queryKlines({
                symbol: this.symbol,
                interval: '1m',
                end: this.clock.date(),
                limit: 1
            });

            if (klines.length > 0) {
                // 这里我们模拟发送一个行情信号给小队，触发小队运作
                // 这在架构上相当于 MAS 小队的“感官”接收到了数据
                const marketSignal = {
                    id: `tick-${now}`,
                    from: 'market-replay',
                    type: 'signal' as const,
                    importance: 'low' as const,
                    timestamp: now,
                    data: {
                        symbol: this.symbol,
                        price: { current: klines[0].close },
                        timeframe: '1m',
                        description: `Market Tick at ${this.clock.date().toISOString()}`
                    } as any
                };

                // 触发 TechAnalyst (它通过构造函数中的订阅会收到此 signal)
                // 在真实环境中，这可能来自 MarketPoller
                // 这里我们显式调用以确保在回测步进中完成
                // @ts-ignore - 定制化触发
                await this.techAnalyst.onFeed(marketSignal);
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
