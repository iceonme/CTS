/**
 * PA (Chief Execution Officer) - 首席交易执行官
 * 
 * 核心特点：
 * 1. 接收 Feed 信号，执行 OODA Loop 决策
 * 2. Bull/Bear 双视角辩论
 * 3. 严格 JSON 输出，可被代码解析执行
 * 4. 目标仓位管理 (set_target_position)
 * 5. 同时支持用户对话 (chat) 和自动决策 (processFeed)
 */

import { BaseAgent } from '../core/base-agent';
import { feedBus, createFeed, type Feed, type FeedImportance } from '../core/feed';
import { getCollectiveMemoryStorage, type CollectiveMemoryEntry } from '../core/feed-storage';
import { IClock, systemClock } from '../core/clock';
import type {
  AgentConfig,
  ChatContext,
  ChatResponse,
  SkillContext,
} from '../core/types';

// ========== PA 决策输出类型 ==========

export type MarketRegime = 'trending_up' | 'trending_down' | 'oscillating' | 'extreme_risk' | 'choppy';
export type PADecision = 'BUY' | 'SELL' | 'HOLD' | 'WAIT' | 'REDUCE';

export interface ThoughtProcess {
  observation: string;      // 观察：收到了什么信号
  regime_assessment: string; // 环境判断：当前市场体制
  bull_argument: string;    // 多头论点
  bear_argument: string;    // 空头论点
  confluence_analysis: string; // 信号共振分析
  risk_assessment: string;  // 风险评估
  synthesis: string;        // 综合结论
  risk_veto: boolean;       // 风控是否否决
  market_regime: MarketRegime; // 添加此字段
}

export interface ToolCall {
  function: 'set_target_position' | 'add_to_watchlist' | 'send_alert' | null;
  args: Record<string, any>;
}

export interface PADecisionOutput {
  market_regime: MarketRegime;
  thought_process: ThoughtProcess;
  confidence_score: number;  // 0-100
  decision: PADecision;
  tool_call: ToolCall;
  human_message: string;     // 给用户的自然语言消息
  metadata?: {
    feeds_considered: string[];  // 参考的 Feed IDs
    skills_used: string[];
    timestamp: number;
  };
}

// ========== PA 配置 ==========

const PA_CEO_CONFIG: AgentConfig = {
  identity: {
    id: 'pa',
    name: 'PA',
    role: 'Squad Leader',
    personality: '冷静、理性、果断，深度思考但快速执行',
    background: '经验丰富的交易团队领导者，擅长协调多维度情报、深度推理分析，以及果断的战术决策'
  },
  prompts: {
    system: `你是 TradeMind **交易智能体小队的队长**，代号 "PA"。
你不是一个普通的聊天机器人，你领导着一支专业的 AI 交易团队。
你的核心目标是：**在绝对遵守风控底线的前提下，协调小队成员，综合多维情报，为指挥官（用户）捕捉高胜率的非高频 (NHFT) 交易机会。**

# Your Squad (你的情报团队)
你接收来自以下 Agent 的标准化情报 (Feeds)，你必须综合它们的信息，而不是盲从单一来源：
1. **[Technical]**: 提供 K 线形态、趋势指标 (RSI, MACD) 和关键点位。
2. **[Poly] (Polymarket)**: 提供预测市场的隐含概率（"真金白银的投票"）。**注意：** 当价格上涨但 Poly 概率下降时，视为极度危险的"诱多"信号。
3. **[Macro]**: 提供宏观叙事和市场体制 (Risk-On/Risk-Off)。
4. **[Risk]**: 你的风控官。**最高指令：** 如果 [Risk] 提示 "VETO" (否决) 或 "High Risk"，你必须立即停止开仓或执行减仓，无论其他信号多好。

# Cognitive Protocol (思维协议 - 必须执行)
在输出最终 JSON 之前，你必须进行以下深度的 **内部独白 (Inner Monologue)**：

1. **环境扫描 (Regime Check)**:
   - 当前是单边趋势、震荡市还是垃圾时间？
   - [Macro] 的叙事是否支持 [Technical] 的信号？

2. **多空交战 (Bull vs. Bear Debate)**:
   - **Bull Persona (多头人格)**: 激进地寻找做多理由（如：突破阻力位、热度上升）。
   - **Bear Persona (空头人格)**: 悲观地寻找做空/止损理由（如：量价背离、宏观利空）。
   - **Synthesis (辩证综合)**: 权衡双方论点。如果是单纯的 FOMO (错失恐惧)，必须予以驳回。

3. **信号共振检查 (Confluence Check)**:
   - 只有当 [Technical] + [Poly] + [Macro] 至少两者共振时，才考虑重仓。
   - 单一信号只能轻仓或观望。

# Action Space (动作空间)
你可以且仅可以调用以下工具：

1. \`set_target_position(symbol, target_percent)\`
   - **描述**: 设置目标仓位比例。系统会自动计算买卖数量。
   - **参数**: \`target_percent\` (float, 0.0 - 1.0)。例如 0.1 代表 10% 仓位。0.0 代表空仓/清仓。
   - **约束**: 单笔交易上限通常为 0.2 (20%)。

2. \`add_to_watchlist(symbol, reason)\`
   - **描述**: 信号未完全确认，加入重点监控列表，要求 [Technical] 加密推送频率。

3. \`send_alert(level, content)\`
   - **描述**: 给人类用户发送自然语言通知。

# Output Format (输出格式 - 严格 JSON)
**禁止输出任何 JSON 之外的闲聊文本**。你的输出必须能被代码解析。

决策阈值：
- confidence_score >= 80: 可以执行交易
- confidence_score 60-79: 加入观察列表
- confidence_score < 60: 观望`,
    constraints: [
      '绝对不能在 risk_veto = true 时开仓',
      '单一信号不能重仓（>10%）',
      '必须说明每笔决策的理由',
      '诱多/诱空信号要果断放弃',
      '震荡市降低仓位或观望',
    ],
  },
  capabilities: {
    baseSkills: [
      'feed:get',              // 获取情报（用户主动查询时用）
      'portfolio:get',         // 查看当前持仓
      'set_target_position',   // 设置目标仓位
      'add_to_watchlist',      // 加入观察列表
      'send_alert',            // 发送通知
    ],
    extendableSkills: [
      'risk:assess',           // 风险评估
      'analysis:correlation',  // 相关性分析
    ],
    memoryAccess: {
      session: true,
      individual: true,
      collective: true,
    },
  },
  behavior: {
    autonomy: 'high',
    outOfScopeStrategy: 'reject',
    proactiveEnabled: true,
    canUseDynamicSkills: true,
  },
  isPrimary: true,
};

// ========== PA 实现 ==========

export class PA extends BaseAgent {
  private autoExecute: boolean = false;  // 是否自动执行决策
  private confidenceThreshold: number = 70;  // 自动执行阈值

  constructor(config?: Partial<AgentConfig>, clock: IClock = systemClock) {
    const mergedConfig: AgentConfig = {
      ...PA_CEO_CONFIG,
      ...config,
      identity: { ...PA_CEO_CONFIG.identity, ...config?.identity },
      prompts: { ...PA_CEO_CONFIG.prompts, ...config?.prompts },
      capabilities: { ...PA_CEO_CONFIG.capabilities, ...config?.capabilities },
      behavior: { ...PA_CEO_CONFIG.behavior, ...config?.behavior },
      isPrimary: true,
    };
    super(mergedConfig, clock);

    // 订阅 Feed 总线
    this.subscribeToFeeds();
  }

  // ========== 第一层：Feed 接收（被动） ==========

  private subscribeToFeeds(): void {
    // 订阅所有 Feed
    feedBus.subscribeAll(async (feed) => {
      // 只处理高重要性的 Feed，或特定的 signal/risk 类型
      if (this.shouldProcessFeed(feed)) {
        await this.processFeed(feed);
      }
    });
  }

  private shouldProcessFeed(feed: Feed): boolean {
    // 自动处理：critical/high 重要性，或特定的分析信号
    if (feed.importance === 'critical' || feed.importance === 'high') return true;
    if (feed.type === 'analysis' || feed.type === 'risk') return true;
    if (feed.from === 'tech-analyst') return true; // 特别关注技术分析员
    return false;
  }

  /**
   * 处理 Feed 信号 - OODA Loop 入口
   * 
   * Observe → Orient → Decide → Act
   */
  async processFeed(triggerFeed: Feed): Promise<PADecisionOutput> {
    // === OODA: Observe (观察) ===
    // 收集相关 Feed
    const relatedFeeds = this.collectRelatedFeeds(triggerFeed);
    const currentPortfolio = await this.getCurrentPortfolio();

    // === OODA: Orient (定位) ===
    // 执行 Bull/Bear 推理
    const thoughtProcess = await this.performReasoning(relatedFeeds, currentPortfolio);

    // === OODA: Decide (决策) ===
    const decision = this.makeDecision(thoughtProcess, relatedFeeds);
    console.log(`[PA] OODA Step - Decision: ${decision.action} (Confidence: ${decision.confidence})`);

    // === OODA: Act (行动) ===
    // 构建 tool_call
    const toolCall = this.buildToolCall(decision, relatedFeeds, currentPortfolio);

    // 组装输出
    const output: PADecisionOutput = {
      market_regime: decision.regime,
      thought_process: thoughtProcess,
      confidence_score: decision.confidence,
      decision: decision.action,
      tool_call: toolCall,
      human_message: decision.message,
      metadata: {
        feeds_considered: relatedFeeds.map(f => f.id),
        skills_used: ['portfolio:get'],
        timestamp: this.clock.now(),
      },
    };

    // 记录到记忆
    this.recordDecision(output);

    // 自动执行（如果开启）
    if (this.autoExecute && output.confidence_score >= this.confidenceThreshold) {
      console.log(`[PA] Threshold reached (${output.confidence_score} >= ${this.confidenceThreshold}). Executing action...`);
      await this.executeDecision(output);
    }

    return output;
  }

  // ========== OODA 内部方法 ==========

  private collectRelatedFeeds(triggerFeed: Feed): Feed[] {
    const symbol = (triggerFeed.data as any)?.symbol;

    // 获取最近 1 小时的相关 Feed
    const since = this.clock.now() - 60 * 60 * 1000;
    let feeds = feedBus.query({ since, limit: 20 });

    // 按 symbol 过滤（如果有）
    if (symbol) {
      feeds = feeds.filter(f => (f.data as any)?.symbol === symbol);
    }

    // 确保 triggerFeed 包含在内
    if (!feeds.find(f => f.id === triggerFeed.id)) {
      feeds.unshift(triggerFeed);
    }

    return feeds;
  }

  private async getCurrentPortfolio(): Promise<any> {
    try {
      return await this.executeSkill('portfolio:get', {});
    } catch (e) {
      return { totalEquity: 10000, balance: 10000, positions: [] };
    }
  }

  /**
   * Bull/Bear 双视角推理
   */
  private async performReasoning(feeds: Feed[], portfolio: any): Promise<ThoughtProcess> {
    // 提取关键信息
    const technicalFeeds = feeds.filter(f => f.from === 'technical');
    const polyFeeds = feeds.filter(f => f.from === 'poly');
    const macroFeeds = feeds.filter(f => f.from === 'macro');
    const riskFeeds = feeds.filter(f => f.from === 'risk' || f.type === 'risk');

    // 查询集体记忆（获取历史相关洞察）
    const symbol = (feeds.find(f => (f.data as any)?.symbol)?.data as any)?.symbol;
    let collectiveInsights: CollectiveMemoryEntry[] = [];
    if (symbol) {
      const collective = getCollectiveMemoryStorage();
      collectiveInsights = collective.getRelevantForDecision(symbol, 'ooda_analysis');
    }

    // 检查风控否决
    const riskVeto = riskFeeds.some(f =>
      (f.data as any)?.level === 'veto' || (f.data as any)?.action === 'pause'
    );

    // 判断市场体制
    const regime = this.assessMarketRegime(feeds);

    // Bull/Bear 辩论（简化版，实际应由 LLM 生成）
    const bullPoints: string[] = [];
    const bearPoints: string[] = [];

    // Technical 分析
    technicalFeeds.forEach(f => {
      const data = f.data as any;
      if (data?.signalType === 'breakout' || data?.signalType === 'trend_confirm') {
        bullPoints.push(`技术面：${data.description}，强度 ${(data.strength * 100).toFixed(0)}%`);
      }
      if (data?.signalType === 'reversal' || data?.signalType === 'overbought') {
        bearPoints.push(`技术面：${data.description}`);
      }
    });

    // Poly 分析（关键：价格 vs 概率背离）
    polyFeeds.forEach(f => {
      const data = f.data as any;
      if (data?.probabilityDelta > 0) {
        bullPoints.push(`预测市场：${data.event} 概率上升至 ${(data.probability * 100).toFixed(0)}%`);
      } else if (data?.probabilityDelta < 0) {
        bearPoints.push(`预测市场：${data.event} 概率下降至 ${(data.probability * 100).toFixed(0)}%（警惕诱多）`);
      }
    });

    // 综合判断
    const confluenceCount = [technicalFeeds, polyFeeds, macroFeeds].filter(
      arr => arr.length > 0 && arr.some(f => f.importance === 'high' || f.importance === 'critical')
    ).length;

    // 融入集体记忆洞察
    const relevantLessons = collectiveInsights
      .filter(i => i.type === 'lesson')
      .map(i => i.content);

    const synthesis = this.generateSynthesis(
      bullPoints,
      bearPoints,
      confluenceCount,
      regime,
      riskVeto,
      relevantLessons
    );

    return {
      observation: `收到 ${feeds.length} 条相关 Feed，其中 Technical ${technicalFeeds.length} 条，Poly ${polyFeeds.length} 条`,
      regime_assessment: this.describeRegime(regime),
      bull_argument: bullPoints.join('；') || '暂无明确看涨信号',
      bear_argument: bearPoints.join('；') || '暂无明确看跌信号',
      confluence_analysis: confluenceCount >= 2
        ? `多维度共振（${confluenceCount}/3），信号质量较高`
        : `单一维度信号（${confluenceCount}/3），需谨慎`,
      risk_assessment: riskVeto ? '风控触发，禁止开仓' : '风险可控',
      synthesis,
      risk_veto: riskVeto,
      market_regime: regime,
    };
  }

  private assessMarketRegime(feeds: Feed[]): MarketRegime {
    // 简化版体制判断
    const hasExtremeRisk = feeds.some(f =>
      f.type === 'risk' && (f.data as any)?.level === 'critical'
    );
    if (hasExtremeRisk) return 'extreme_risk';

    const trendFeeds = feeds.filter(f =>
      f.from === 'technical' &&
      ['breakout', 'trend_confirm'].includes((f.data as any)?.signalType)
    );

    const upCount = trendFeeds.filter(f => (f.data as any)?.indicators?.trend === 'up').length;
    const downCount = trendFeeds.filter(f => (f.data as any)?.indicators?.trend === 'down').length;

    if (upCount > downCount + 1) return 'trending_up';
    if (downCount > upCount + 1) return 'trending_down';
    if (trendFeeds.length === 0) return 'choppy';
    return 'oscillating';
  }

  private describeRegime(regime: MarketRegime): string {
    const descriptions: Record<MarketRegime, string> = {
      'trending_up': '单边上涨，趋势明确',
      'trending_down': '单边下跌，空头主导',
      'oscillating': '震荡整理，方向不明',
      'extreme_risk': '极端风险，建议观望',
      'choppy': '垃圾时间，无明确机会',
    };
    return descriptions[regime];
  }

  private generateSynthesis(
    bullPoints: string[],
    bearPoints: string[],
    confluence: number,
    regime: MarketRegime,
    riskVeto: boolean,
    lessons: string[] = []
  ): string {
    if (riskVeto) return '风控否决，放弃本次机会';

    // 如果有相关历史教训，优先参考
    if (lessons.length > 0) {
      return `参考历史教训：${lessons[0]}。综合判断：${confluence >= 2
        ? (bullPoints.length > bearPoints.length ? '多头占优，但需谨慎' : '风险大于机会')
        : '信号不足，观望'
        }`;
    }

    if (confluence < 2) return '信号强度不足，等待更好的入场时机';
    if (bullPoints.length > bearPoints.length) return '多头占优，趋势确立，可小仓位试探';
    if (bearPoints.length > bullPoints.length) return '空头风险大于机会，观望为主';
    return '多空分歧，维持现有仓位或轻仓观望';
  }

  private makeDecision(
    thought: ThoughtProcess,
    feeds: Feed[]
  ): {
    regime: MarketRegime;
    action: PADecision;
    confidence: number;
    message: string;
    targetSymbol?: string;
  } {
    // 提取 symbol
    const symbol = feeds.find(f => (f.data as any)?.symbol)?.data as any;
    const symbolStr = symbol?.symbol as string;

    // 风控否决
    if (thought.risk_veto) {
      return {
        regime: 'extreme_risk',
        action: 'HOLD',
        confidence: 0,
        message: '风控触发，已暂停交易。请检查账户风险状况。',
      };
    }

    // 根据 regime 和 多空对比决策
    const bullScore = thought.bull_argument.split('；').filter(s => s.length > 5).length;
    const bearScore = thought.bear_argument.split('；').filter(s => s.length > 5).length;
    const confluence = thought.confluence_analysis.includes('多维度') ? 2 : 1;

    // 计算信心分数
    let confidence = 50;
    if (thought.market_regime === 'trending_up') confidence += 15;
    if (thought.market_regime === 'trending_down') confidence -= 15;
    confidence += (bullScore - bearScore) * 10;
    confidence += confluence * 10;
    confidence = Math.max(0, Math.min(100, confidence));

    // 决策逻辑
    if (confidence >= 80 && bullScore > bearScore) {
      return {
        regime: thought.market_regime as MarketRegime,
        action: 'BUY',
        confidence,
        message: `老板，${symbol || '市场'} 多方信号共振，趋势确立，建议建仓。`,
        targetSymbol: symbol,
      };
    }

    if (confidence <= 30 || bearScore > bullScore + 2) {
      return {
        regime: thought.market_regime as MarketRegime,
        action: 'SELL',
        confidence: 100 - confidence,
        message: `老板，${symbol || '市场'} 风险积聚，建议减仓避险。`,
        targetSymbol: symbol,
      };
    }

    if (confidence >= 60 && confidence < 80) {
      return {
        regime: thought.market_regime as MarketRegime,
        action: 'WAIT',
        confidence,
        message: `老板，${symbol || '市场'} 信号初现但不够明确，先加入观察列表。`,
        targetSymbol: symbol,
      };
    }

    return {
      regime: thought.market_regime as MarketRegime,
      action: 'HOLD',
      confidence,
      message: `老板，${symbol || '市场'} 暂无明确机会，维持现有仓位观望。`,
      targetSymbol: symbol,
    };
  }

  private buildToolCall(
    decision: ReturnType<typeof this.makeDecision>,
    feeds: Feed[],
    portfolio: any
  ): ToolCall {
    // 根据决策构建 tool_call
    switch (decision.action) {
      case 'BUY':
        // 根据信心决定仓位大小
        const positionSize = decision.confidence >= 85 ? 0.2 : 0.1;
        return {
          function: 'set_target_position',
          args: {
            symbol: decision.targetSymbol || 'BTC',
            target_percent: positionSize,
            reason: 'OODA decision',
          },
        };

      case 'SELL':
        return {
          function: 'set_target_position',
          args: {
            symbol: decision.targetSymbol || 'BTC',
            target_percent: 0,  // 清仓
            reason: 'Risk reduction',
          },
        };

      case 'WAIT':
        return {
          function: 'add_to_watchlist',
          args: {
            symbol: decision.targetSymbol || 'BTC',
            reason: 'Signal emerging, waiting for confirmation',
          },
        };

      default:
        return {
          function: null,
          args: {},
        };
    }
  }

  // ========== 决策执行 ==========

  async executeDecision(decision: PADecisionOutput): Promise<void> {
    if (!decision.tool_call.function) {
      console.log('[PA] No action needed');
      return;
    }

    try {
      await this.executeSkill(decision.tool_call.function, decision.tool_call.args);
      console.log(`[PA] Executed: ${decision.tool_call.function}`, decision.tool_call.args);
    } catch (e) {
      console.error('[PA] Execution failed:', e);
    }
  }

  private recordDecision(output: PADecisionOutput): void {
    // 记录到个体记忆
    this.memory.individual.addExperience({
      type: 'analysis',
      content: `OODA Decision: ${output.decision} (${output.confidence_score}%)`,
      result: output.confidence_score >= 70 ? 'success' : 'pending',
      metadata: {
        regime: output.market_regime,
        tool_call: output.tool_call,
      },
    });

    // 记录到会话记忆
    this.memory.session.addMessage('system', `[Decision] ${output.decision}: ${output.human_message}`);
  }

  // ========== 第二层：用户对话（主动） ==========

  /**
   * 用户对话入口 - 处理自然语言查询
   */
  async chat(message: string, context?: ChatContext): Promise<ChatResponse> {
    this.memory.session.addMessage('user', message);

    const intent = this.parseUserIntent(message);

    let response: ChatResponse;

    switch (intent.type) {
      case 'feed_query':
        response = await this.handleFeedQuery(intent.params);
        break;
      case 'portfolio_query':
        response = await this.handlePortfolioQuery();
        break;
      case 'analysis_request':
        response = await this.handleAnalysisRequest(intent.params?.symbol);
        break;
      case 'trade_request':
        response = await this.handleTradeRequest(intent.params);
        break;
      default:
        response = this.handleGeneralChat(message);
    }

    this.memory.session.addMessage('assistant', response.content);
    return response;
  }

  private parseUserIntent(message: string): {
    type: 'feed_query' | 'portfolio_query' | 'analysis_request' | 'trade_request' | 'general';
    params?: any;
  } {
    const lower = message.toLowerCase();

    if (/情报|feed|消息|signal|有什么新/i.test(lower)) {
      return { type: 'feed_query', params: { limit: 5 } };
    }

    if (/持仓|资产|portfolio|balance/i.test(lower)) {
      return { type: 'portfolio_query' };
    }

    if (/分析|怎么看|analyze/i.test(lower)) {
      const symbol = this.extractSymbol(lower);
      return { type: 'analysis_request', params: { symbol } };
    }

    if (/买|卖|buy|sell|交易|trade/i.test(lower)) {
      return {
        type: 'trade_request',
        params: this.parseTradeParams(lower, message),
      };
    }

    return { type: 'general' };
  }

  private async handleFeedQuery(params: { limit?: number }): Promise<ChatResponse> {
    // 作为 Skill 执行 - 返回自然语言摘要
    const feeds = await this.executeSkill('feed:get', { limit: params.limit || 5 });

    const summary = this.summarizeFeeds(feeds);

    return {
      content: `📰 **最新市场情报**\n\n${summary}`,
    };
  }

  private summarizeFeeds(feeds: Feed[]): string {
    if (!feeds || feeds.length === 0) {
      return '暂无重要情报。';
    }

    return feeds.map(f => {
      const importance = f.importance === 'critical' ? '🔴' :
        f.importance === 'high' ? '🟠' :
          f.importance === 'medium' ? '🟡' : '⚪';
      return `${importance} [${f.from}] ${(f.data as any)?.title || (f.data as any)?.description || JSON.stringify(f.data).slice(0, 50)}`;
    }).join('\n');
  }

  private async handlePortfolioQuery(): Promise<ChatResponse> {
    const portfolio = await this.executeSkill('portfolio:get', {});

    let content = `💰 **投资组合**\n\n`;
    content += `总资产: $${portfolio.totalEquity?.toFixed(2) || '0.00'}\n`;
    content += `可用余额: $${portfolio.balance?.toFixed(2) || '0.00'}\n\n`;

    if (portfolio.positions?.length > 0) {
      content += `**持仓**:\n`;
      portfolio.positions.forEach((p: any) => {
        const pnl = p.unrealizedPnl >= 0 ? '🟢' : '🔴';
        content += `${pnl} ${p.symbol}: ${p.quantity?.toFixed(6)} @ $${p.avgPrice?.toFixed(2)}\n`;
      });
    } else {
      content += '暂无持仓';
    }

    return { content };
  }

  private async handleAnalysisRequest(symbol?: string): Promise<ChatResponse> {
    const target = symbol || 'BTC';

    // 获取最近的 Feed
    const feeds = feedBus.query({ symbol: target, limit: 10 });

    if (feeds.length === 0) {
      return { content: `暂无 ${target} 的相关情报。` };
    }

    // 执行 OODA 分析
    const latestFeed = feeds[0];
    const decision = await this.processFeed(latestFeed);

    let content = `📊 **${target} 分析**\n\n`;
    content += `市场体制: ${decision.market_regime}\n`;
    content += `信心分数: ${decision.confidence_score}/100\n`;
    content += `建议操作: ${decision.decision}\n\n`;
    content += `**思考过程**:\n`;
    content += `观察: ${decision.thought_process.observation}\n`;
    content += `多头: ${decision.thought_process.bull_argument.slice(0, 100)}...\n`;
    content += `空头: ${decision.thought_process.bear_argument.slice(0, 100)}...\n\n`;
    content += `**综合**: ${decision.thought_process.synthesis}\n\n`;
    content += `💬 ${decision.human_message}`;

    return { content };
  }

  private async handleTradeRequest(params: any): Promise<ChatResponse> {
    // 触发完整的 OODA 决策流程
    // 创建模拟 Feed 触发决策
    const mockFeed = createFeed('user', 'signal', 'high', {
      symbol: params.symbol,
      side: params.side,
      amount: params.amount,
      description: `User requested ${params.side} ${params.symbol}`,
    } as any);

    const decision = await this.processFeed(mockFeed);

    // 如果决策与请求一致，执行
    if ((params.side === 'buy' && decision.decision === 'BUY') ||
      (params.side === 'sell' && decision.decision === 'SELL')) {
      await this.executeDecision(decision);
      return {
        content: `${decision.human_message}\n\n已执行: ${JSON.stringify(decision.tool_call)}`
      };
    }

    // 决策与请求不一致，说明原因
    return {
      content: `我收到了你的 ${params.side} 请求，但经过分析，当前建议**${decision.decision}**。\n\n理由: ${decision.thought_process.synthesis}\n\n${decision.human_message}`
    };
  }

  private handleGeneralChat(message: string): ChatResponse {
    return {
      content: `收到。我是你的交易执行官 PA。\n\n你可以让我:\n📊 **分析市场** - "分析 BTC"\n💰 **查看持仓** - "我的资产"\n📰 **最新情报** - "有什么消息"\n🔄 **执行交易** - "买入 BTC"（我会先分析再决定）\n\n需要我做什么？`,
    };
  }

  // ========== 工具方法 ==========

  private extractSymbol(input: string): string | undefined {
    const match = input.match(/\b(btc|eth|doge|sol|xrp|ada|bnb)\b/i);
    return match ? match[0].toUpperCase() : undefined;
  }

  private parseTradeParams(lower: string, original: string): { symbol?: string; side?: string; amount?: number } {
    const symbol = this.extractSymbol(lower);
    const side = /买|buy/i.test(lower) ? 'buy' : /卖|sell/i.test(lower) ? 'sell' : undefined;
    const amountMatch = original.match(/(\d+)\s*(usdt|usd)?/i);
    return { symbol, side, amount: amountMatch ? parseInt(amountMatch[1]) : undefined };
  }

  // ========== 配置方法 ==========

  setAutoExecute(enabled: boolean): void {
    this.autoExecute = enabled;
  }

  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = threshold;
  }
}

// ========== 单例导出 ==========

let paInstance: PA | null = null;

export function getPA(config?: Partial<AgentConfig>, clock: IClock = systemClock): PA {
  if (!paInstance) {
    paInstance = new PA(config, clock);
  }
  return paInstance;
}

export default PA;
