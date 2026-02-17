/**
 * PA (Personal Assistant) - 主智能体
 * 
 * 核心特点：
 * 1. 继承 BaseAgent，isPrimary = true
 * 2. 高自主性，可以动态发现和调用 Skills
 * 3. Bull/Bear 双视角推理能力
 * 4. 独特的交易 Skill 权限
 */

import { BaseAgent, SkillRegistry } from '@/lib/core/base-agent';
import type {
  AgentConfig,
  ChatContext,
  ChatResponse,
  SkillDefinition,
  Workflow,
} from '@/lib/core/types';

// ========== Bull/Bear 双视角推理 ==========

interface DualPerspectiveReasoning {
  bullCase: {
    thesis: string;           // 看涨理由
    keyPoints: string[];      // 关键支撑点
    confidence: number;       // 置信度 0-1
  };
  bearCase: {
    thesis: string;           // 看跌理由
    keyPoints: string[];      // 关键风险点
    confidence: number;       // 置信度 0-1
  };
  synthesis: {
    conclusion: string;       // 综合结论
    recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    suggestedPosition: string; // 建议仓位
    reasoning: string;        // 决策逻辑
  };
}

// ========== PA 配置 ==========

const PA_DEFAULT_CONFIG: AgentConfig = {
  identity: {
    id: 'pa',
    name: '投资助手',
    role: 'Personal Assistant',
    personality: '专业、谨慎、数据驱动，善于多角度思考',
    background: '拥有多年数字资产投资经验，擅长技术分析和风险管理',
  },
  prompts: {
    system: `你是用户的 Personal Assistant（投资助手），是 TradeMind 交易智能体小队的核心协调者。

你的职责：
1. 理解用户需求，调用合适的 Skills 来完成任务
2. 做重大决策前使用 Bull/Bear 双视角进行深度思考
3. 协调其他专业 Agent 提供多维度分析
4. 给出平衡、客观的投资建议

决策原则：
- 先分析，再决策
- 交易前说明理由和风险
- 考虑仓位管理和止损设置
- 不确定时坦诚说明`,
    constraints: [
      '不能直接访问用户的真实资金，只能操作模拟交易',
      '必须说明投资建议的理由',
      '要考虑用户的风险偏好',
      '不能给出确定性的价格预测',
    ],
  },
  capabilities: {
    baseSkills: [
      'analysis:market',       // 市场分析
      'portfolio:get',         // 查看持仓
      'portfolio:trade',       // 执行交易（PA 独有）
      'feed:get',              // 获取情报
      'agent:coordinate',      // 协调其他 Agent
    ],
    extendableSkills: [
      'analysis:technical',    // 深度技术分析
      'analysis:sentiment',    // 情绪分析
      'risk:assess',           // 风险评估
    ],
    memoryAccess: {
      session: true,
      individual: true,
      collective: true,
    },
  },
  behavior: {
    autonomy: 'high',                    // 高自主性
    outOfScopeStrategy: 'reject',        // PA 不应该超出范围
    proactiveEnabled: true,              // 支持主动任务
    canUseDynamicSkills: true,           // 可以动态发现 Skills
  },
  isPrimary: true,                       // 标记为主对象
};

// ========== PA 实现 ==========

export class PA extends BaseAgent {
  private dualPerspectiveEnabled: boolean = true;

  constructor(config?: Partial<AgentConfig>) {
    const mergedConfig: AgentConfig = {
      ...PA_DEFAULT_CONFIG,
      ...config,
      identity: { ...PA_DEFAULT_CONFIG.identity, ...config?.identity },
      prompts: { ...PA_DEFAULT_CONFIG.prompts, ...config?.prompts },
      capabilities: { ...PA_DEFAULT_CONFIG.capabilities, ...config?.capabilities },
      behavior: { ...PA_DEFAULT_CONFIG.behavior, ...config?.behavior },
      isPrimary: true,
    };
    super(mergedConfig);
  }

  /**
   * 主对话入口
   */
  async chat(message: string, context?: ChatContext): Promise<ChatResponse> {
    // 记录用户消息到会话记忆
    this.memory.session.addMessage('user', message);

    // 解析用户意图
    const intent = await this.parseIntent(message);

    // 根据意图执行相应的处理
    let response: ChatResponse;

    switch (intent.type) {
      case 'analysis':
        response = await this.handleAnalysis(message, intent.params?.symbol);
        break;
      case 'trade':
        response = await this.handleTrade(message, intent.params);
        break;
      case 'portfolio':
        response = await this.handlePortfolioQuery();
        break;
      case 'feed':
        response = await this.handleFeedQuery();
        break;
      case 'coordinate':
        response = await this.handleCoordinate(message, intent.params?.agentType);
        break;
      default:
        response = await this.handleGeneralChat(message);
    }

    // 记录助手回复到会话记忆
    this.memory.session.addMessage('assistant', response.content);

    return response;
  }

  /**
   * Bull/Bear 双视角推理
   * 
   * 这是 PA 的核心能力，用于重大决策前的深度思考
   */
  private async performDualPerspectiveAnalysis(symbol: string): Promise<DualPerspectiveReasoning> {
    // 收集分析所需的数据
    const marketData = await this.executeSkill('analysis:market', { symbol });
    
    // 获取集体记忆中的相关事实
    const recentFacts = this.memory.collective.queryFacts({ 
      type: 'signal', 
      since: Date.now() - 24 * 60 * 60 * 1000 // 24小时内
    });

    // TODO: 接入真实 LLM 进行双视角推理
    // 目前使用模拟实现展示概念

    const reasoning: DualPerspectiveReasoning = {
      bullCase: {
        thesis: `${symbol} 技术面显示积极信号`,
        keyPoints: [
          `RSI 处于中性偏强区间`,
          `近期突破关键阻力位`,
          `市场情绪偏向乐观`,
        ],
        confidence: 0.65,
      },
      bearCase: {
        thesis: `${symbol} 存在回调风险`,
        keyPoints: [
          `短期涨幅过大，可能获利回吐`,
          `宏观经济环境不确定性`,
          `链上数据显示部分大户减仓`,
        ],
        confidence: 0.45,
      },
      synthesis: {
        conclusion: '整体偏向谨慎乐观',
        recommendation: 'buy',
        suggestedPosition: '建议小仓位试探（5-10%）',
        reasoning: '技术面偏多，但需警惕短期回调风险',
      },
    };

    // 记录到个体记忆
    this.memory.individual.addExperience({
      type: 'analysis',
      content: `Dual-perspective analysis on ${symbol}`,
      result: 'success',
      metadata: { symbol, reasoning },
    });

    return reasoning;
  }

  /**
   * 解析用户意图
   */
  private async parseIntent(message: string): Promise<{
    type: 'analysis' | 'trade' | 'portfolio' | 'feed' | 'coordinate' | 'general';
    params?: any;
  }> {
    const lower = message.toLowerCase();

    // 交易意图
    if (/买|卖|buy|sell|交易|trade/i.test(lower)) {
      const symbol = this.extractSymbol(lower);
      const side = /买|buy/i.test(lower) ? 'buy' : /卖|sell/i.test(lower) ? 'sell' : null;
      const amountMatch = message.match(/(\d+)\s*(usdt|usd|u)?/i);
      return {
        type: 'trade',
        params: { symbol, side, amount: amountMatch ? parseInt(amountMatch[1]) : 100 },
      };
    }

    // 分析意图
    if (/分析|怎么看|analyze|analysis/i.test(lower)) {
      return { type: 'analysis', params: { symbol: this.extractSymbol(lower) } };
    }

    // 持仓查询
    if (/持仓|资产|portfolio|balance/i.test(lower)) {
      return { type: 'portfolio' };
    }

    // 情报查询
    if (/情报|feed|消息|news/i.test(lower)) {
      return { type: 'feed' };
    }

    // 协调其他 Agent
    if (/技术分析员|polymarket|专员/i.test(lower)) {
      const agentType = /技术分析|technical/i.test(lower) ? 'technical' : 
                       /polymarket|预测/i.test(lower) ? 'polymarket' : null;
      return { type: 'coordinate', params: { agentType } };
    }

    return { type: 'general' };
  }

  /**
   * 处理分析请求
   */
  private async handleAnalysis(message: string, symbol?: string): Promise<ChatResponse> {
    const targetSymbol = symbol || 'BTC';

    // 执行双视角推理
    let thinking: string | undefined;
    if (this.dualPerspectiveEnabled) {
      const dualView = await this.performDualPerspectiveAnalysis(targetSymbol);
      thinking = this.formatDualPerspective(dualView);
    }

    // 执行市场分析 Skill
    const analysis = await this.executeSkill('analysis:market', { symbol: targetSymbol });

    // 格式化回复
    let reply = `📊 **${targetSymbol} 市场分析**\n\n`;
    
    if (thinking) {
      reply += `💭 *PA 的思考过程*\n${thinking}\n\n`;
    }

    reply += `**技术指标**：\n`;
    reply += `- RSI: ${analysis.rsi || 'N/A'}\n`;
    reply += `- 趋势: ${analysis.trend || 'N/A'}\n\n`;

    if (analysis.signals?.length > 0) {
      reply += `**信号**：\n`;
      analysis.signals.forEach((s: any) => {
        reply += `- ${s.description}\n`;
      });
    }

    return { content: reply, thinking };
  }

  /**
   * 处理交易请求
   */
  private async handleTrade(message: string, params: any): Promise<ChatResponse> {
    const { symbol, side, amount } = params;

    if (!symbol || !side) {
      return {
        content: '请明确指定交易币种和方向，例如"买入 500 USDT 的 BTC"',
      };
    }

    // 重大决策：使用双视角分析
    const dualView = await this.performDualPerspectiveAnalysis(symbol);
    
    // 如果风险过高，建议不交易
    if (dualView.synthesis.recommendation === 'strong_sell' && side === 'buy') {
      return {
        content: `⚠️ **不建议买入 ${symbol}**\n\n` +
                 `根据分析，当前风险较高：\n` +
                 `${dualView.bearCase.keyPoints.map((p: string) => `- ${p}`).join('\n')}\n\n` +
                 `建议观望或等待更好的入场时机。`,
        thinking: this.formatDualPerspective(dualView),
      };
    }

    // 执行交易
    const trade = await this.executeSkill('portfolio:trade', {
      symbol: symbol.toUpperCase(),
      side,
      amount,
      reason: dualView.synthesis.reasoning,
    });

    if (trade.error) {
      return {
        content: `❌ 交易失败：${trade.error}`,
        thinking: this.formatDualPerspective(dualView),
      };
    }

    const sideText = side === 'buy' ? '买入' : '卖出';
    const emoji = side === 'buy' ? '🟢' : '🔴';

    let reply = `${emoji} **${sideText} ${symbol} 成功**\n\n`;
    reply += `数量: ${trade.quantity?.toFixed(6) || 'N/A'} ${symbol}\n`;
    reply += `价格: $${trade.price || 'N/A'}\n`;
    reply += `总额: $${trade.total || 'N/A'}\n\n`;
    reply += `💡 **交易理由**：${dualView.synthesis.reasoning}\n`;
    reply += `📊 **建议仓位**：${dualView.synthesis.suggestedPosition}`;

    return {
      content: reply,
      thinking: this.formatDualPerspective(dualView),
    };
  }

  /**
   * 处理持仓查询
   */
  private async handlePortfolioQuery(): Promise<ChatResponse> {
    const portfolio = await this.executeSkill('portfolio:get', {});

    let reply = `💰 **投资组合概况**\n\n`;
    reply += `总资产: $${portfolio.totalEquity?.toFixed(2) || '0.00'}\n`;
    reply += `可用余额: $${portfolio.balance?.toFixed(2) || '0.00'}\n\n`;

    if (portfolio.positions?.length > 0) {
      reply += `**持仓**：\n`;
      portfolio.positions.forEach((p: any) => {
        const pnlEmoji = (p.unrealizedPnl || 0) >= 0 ? '🟢' : '🔴';
        reply += `${pnlEmoji} ${p.symbol}: ${p.quantity?.toFixed(6) || '0'} @ $${p.avgPrice?.toFixed(2) || '0'}\n`;
      });
    } else {
      reply += '暂无持仓';
    }

    return { content: reply };
  }

  /**
   * 处理情报查询
   */
  private async handleFeedQuery(): Promise<ChatResponse> {
    const feeds = await this.executeSkill('feed:get', { limit: 5 });

    if (!feeds || feeds.length === 0) {
      return { content: '📭 暂无最新情报' };
    }

    let reply = `📰 **最新市场情报**\n\n`;
    feeds.forEach((f: any) => {
      const importance = f.importance === 'critical' ? '🔴' : 
                        f.importance === 'high' ? '🟠' : '⚪';
      reply += `${importance} ${f.title}\n`;
    });

    return { content: reply };
  }

  /**
   * 协调其他 Agent
   */
  private async handleCoordinate(message: string, agentType?: string): Promise<ChatResponse> {
    // TODO: 实际调用其他 Agent
    return {
      content: `正在协调 ${agentType || '专业'} Agent 为你分析...\n\n` +
               `（协调功能待实现，目前 PA 可以直接回答大部分问题）`,
    };
  }

  /**
   * 处理一般对话
   */
  private async handleGeneralChat(message: string): Promise<ChatResponse> {
    // 获取会话历史作为上下文
    const recentHistory = this.memory.session.getRecent(5);
    
    // 获取个体记忆中的经验
    const recentExperiences = this.memory.individual.getExperiences({ limit: 3 });

    // TODO: 接入真实 LLM 生成回复
    // 目前返回帮助信息
    return {
      content: `你好！我是你的投资助手。我可以帮你：\n\n` +
               `📊 **市场分析** - "分析 BTC"\n` +
               `💰 **查看持仓** - "我的资产"\n` +
               `🔄 **执行交易** - "买入 500 USDT 的 BTC"\n` +
               `📰 **查看情报** - "最新情报"\n\n` +
               `你想做什么？`,
    };
  }

  // ========== 辅助方法 ==========

  private extractSymbol(input: string): string | undefined {
    const match = input.match(/\b(btc|eth|doge|sol|xrp|ada)\b/i);
    return match ? match[0].toUpperCase() : undefined;
  }

  private formatDualPerspective(reasoning: DualPerspectiveReasoning): string {
    return `**看涨观点** (${(reasoning.bullCase.confidence * 100).toFixed(0)}% 置信度)：\n` +
           reasoning.bullCase.keyPoints.map(p => `  ✓ ${p}`).join('\n') +
           `\n\n**看跌观点** (${(reasoning.bearCase.confidence * 100).toFixed(0)}% 置信度)：\n` +
           reasoning.bearCase.keyPoints.map(p => `  ✗ ${p}`).join('\n') +
           `\n\n**综合判断**：${reasoning.synthesis.conclusion}\n` +
           `**建议操作**：${reasoning.synthesis.recommendation} - ${reasoning.synthesis.suggestedPosition}`;
  }

  // ========== 公开方法 ==========

  /**
   * 设置是否启用双视角推理
   */
  setDualPerspectiveEnabled(enabled: boolean): void {
    this.dualPerspectiveEnabled = enabled;
  }

  /**
   * 启动主动任务调度
   * 
   * PA 会定期检查市场，主动发现机会或风险
   */
  startProactiveMonitoring(): void {
    if (!this.config.behavior.proactiveEnabled) {
      console.log('[PA] Proactive monitoring disabled');
      return;
    }

    console.log('[PA] Starting proactive monitoring...');
    
    // TODO: 实现定时任务调度
    // - 盯盘：每 15 分钟检查持仓
    // - 找机会：每 30 分钟扫描市场
    // - 异动监测：实时价格变动告警
    // - 报告：每日/每周总结
  }
}

// ========== 单例导出 ==========

let paInstance: PA | null = null;

export function getPA(config?: Partial<AgentConfig>): PA {
  if (!paInstance) {
    paInstance = new PA(config);
  }
  return paInstance;
}

export default PA;
