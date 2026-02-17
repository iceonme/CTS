/**
 * PA Agent (Personal Assistant)
 * 
 * 核心设计：LLM + Skills
 * - 所有决策由 LLM 做出
 * - Skills 通过 function calling 被调用
 * - 交易只是其中一个 Skill
 */

import { getTechnicalAnalyst } from "./tech-analyst";
import { getPolymarketAgent } from "./polymarket-analyst";
import { getFeedItems } from "@/lib/feed/publisher";
import type { AgentTask, IntelligenceItem } from "@/lib/types";

// Skills 描述（给 LLM 看的）
const SKILLS_DESCRIPTION = `
你是 PA (Personal Assistant)，用户的智能投资助手。

你可以调用以下 Skills 来帮助用户：

## 1. analysis:market (市场分析)
分析指定币种的市场情况，返回技术面、情绪面分析。
参数：{ "symbol": "BTC" }

## 2. portfolio:get (查看持仓)
获取当前投资组合的状态。
参数：{}

## 3. simulation:trade (模拟交易)
在模拟环境中执行交易。
参数：{ 
  "symbol": "BTC",
  "side": "buy" | "sell",
  "amount": 500,  // 买入金额 (USD)
  "reason": "为什么执行这个交易"
}

## 4. feed:get (获取情报)
获取最新的市场情报 Feed。
参数：{ "limit": 10 }

决策原则：
- 先分析，再决策
- 交易前说明理由
- 考虑风险，建议仓位大小
`;

export interface PAConfig {
  name: string;
  personality: string;
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  maxPositionSize: number; // 最大仓位百分比
  enabledSkills: string[];
}

export class PAAgent {
  private config: PAConfig;
  private conversationHistory: Array<{ role: 'user' | 'assistant' | 'tool'; content: string; }> = [];

  constructor(config?: Partial<PAConfig>) {
    this.config = {
      name: config?.name || '投资助手',
      personality: config?.personality || '专业、谨慎、数据驱动',
      riskLevel: config?.riskLevel || 'moderate',
      maxPositionSize: config?.maxPositionSize || 30,
      enabledSkills: config?.enabledSkills || ['analysis:market', 'portfolio:get', 'simulation:trade', 'feed:get'],
    };
  }

  /**
   * 主入口：处理用户输入
   * 
   * 正确的流程：
   * 1. 构建带 Skills 描述的 prompt
   * 2. 调用 LLM
   * 3. LLM 决定是否调用 Skill
   * 4. 执行 Skill
   * 5. 返回自然语言回复
   */
  async chat(userInput: string): Promise<{
    reply: string;
    actions?: Array<{
      skill: string;
      params: any;
      result: any;
    }>;
  }> {
    // 构建 system prompt
    const systemPrompt = this.buildSystemPrompt();

    // 添加到历史
    this.conversationHistory.push({ role: 'user', content: userInput });

    // 这里应该调用 LLM API
    // 简化起见，我们先做规则匹配演示正确的概念
    const { reply, skillCalls } = await this.mockLLMCall(systemPrompt, userInput);

    // 执行 Skill 调用
    const actions = [];
    for (const call of skillCalls) {
      const result = await this.executeSkill(call.skill, call.params);
      actions.push({
        skill: call.skill,
        params: call.params,
        result,
      });
    }

    // 添加到历史
    this.conversationHistory.push({ role: 'assistant', content: reply });

    return { reply, actions: actions.length > 0 ? actions : undefined };
  }

  /**
   * 构建 System Prompt
   */
  private buildSystemPrompt(): string {
    return `你是 ${this.config.name}，用户的个人投资助手。

性格: ${this.config.personality}
风险偏好: ${this.config.riskLevel}
最大仓位: ${this.config.maxPositionSize}%

${SKILLS_DESCRIPTION}

回复格式：
1. 先给出分析和建议
2. 如果要执行交易，明确说明理由和参数
3. 使用中文回复`;
  }

  /**
   * Mock LLM 调用（实际应该调用 OpenAI/Claude API）
   * 
   * 这里用规则匹配演示正确的概念
   */
  private async mockLLMCall(
    systemPrompt: string,
    userInput: string
  ): Promise<{
    reply: string;
    skillCalls: Array<{ skill: string; params: any }>;
  }> {
    const input = userInput.toLowerCase();
    const skillCalls: Array<{ skill: string; params: any }> = [];
    let reply = '';

    // 分析请求
    if (input.includes('分析') || input.includes('怎么看')) {
      const symbol = this.extractSymbol(input) || 'BTC';
      skillCalls.push({ skill: 'analysis:market', params: { symbol } });
      
      const analysis = await this.executeSkill('analysis:market', { symbol });
      reply = this.formatAnalysisReply(symbol, analysis);
    }
    // 持仓查询
    else if (input.includes('持仓') || input.includes('资产') || input.includes('portfolio')) {
      skillCalls.push({ skill: 'portfolio:get', params: {} });
      
      const portfolio = await this.executeSkill('portfolio:get', {});
      reply = this.formatPortfolioReply(portfolio);
    }
    // 交易请求
    else if (input.includes('买') || input.includes('sell') || input.includes('买入') || input.includes('卖出')) {
      const { symbol, side, amount } = this.parseTradeIntent(input);
      
      if (symbol && side) {
        // 先分析
        const analysis = await this.executeSkill('analysis:market', { symbol });
        
        // 再执行交易
        skillCalls.push({ 
          skill: 'simulation:trade', 
          params: { symbol, side, amount, reason: analysis.summary } 
        });
        
        const trade = await this.executeSkill('simulation:trade', { 
          symbol, side, amount, reason: analysis.summary 
        });
        
        reply = this.formatTradeReply(symbol, side, amount, trade, analysis);
      } else {
        reply = '请指定要交易的币种，例如"买入 100 USDT 的 BTC"';
      }
    }
    // 情报查询
    else if (input.includes('情报') || input.includes('feed') || input.includes('消息')) {
      skillCalls.push({ skill: 'feed:get', params: { limit: 10 } });
      
      const feeds = await this.executeSkill('feed:get', { limit: 10 });
      reply = this.formatFeedReply(feeds);
    }
    // 默认回复
    else {
      reply = `我可以帮你：\n\n` +
        `📊 **市场分析** - "分析 BTC"\n` +
        `💰 **查看持仓** - "我的资产"\n` +
        `🔄 **执行交易** - "买入 500 USDT 的 BTC"\n` +
        `📰 **查看情报** - "最新情报"\n\n` +
        `你想做什么？`;
    }

    return { reply, skillCalls };
  }

  /**
   * 执行 Skill
   */
  private async executeSkill(skill: string, params: any): Promise<any> {
    switch (skill) {
      case 'analysis:market': {
        const analyst = getTechnicalAnalyst();
        try {
          const result = await analyst.analyzeSymbol(params.symbol);
          return {
            symbol: result.symbol,
            rsi: result.indicators.rsi,
            trend: result.indicators.trend,
            signals: result.signals.map(s => ({ type: s.type, description: s.description })),
            summary: `${result.symbol} 当前 RSI: ${result.indicators.rsi}, 趋势: ${result.indicators.trend}`,
          };
        } catch (error) {
          return { error: '分析失败' };
        }
      }

      case 'portfolio:get': {
        const { getPortfolioManager } = await import('@/lib/trading/portfolio');
        const pm = getPortfolioManager();
        const p = pm.getPortfolio();
        return {
          totalEquity: p.totalEquity,
          balance: p.balance,
          positions: p.positions.map(pos => ({
            symbol: pos.symbol,
            quantity: pos.quantity,
            avgPrice: pos.avgPrice,
            unrealizedPnl: pos.unrealizedPnl,
          })),
        };
      }

      case 'simulation:trade': {
        const { getPortfolioManager } = await import('@/lib/trading/portfolio');
        const pm = getPortfolioManager();
        
        // 获取价格计算数量
        const mockPrices: Record<string, number> = { BTC: 68400, DOGE: 0.1, ETH: 3500 };
        const price = mockPrices[params.symbol.toUpperCase()] || 100;
        const quantity = params.amount / price;
        
        const result = pm.executeTrade({
          symbol: params.symbol.toUpperCase(),
          side: params.side,
          type: 'market',
          quantity,
          price,
          notes: params.reason,
        });

        if (!result.success) {
          return { error: result.error };
        }

        return {
          id: result.trade?.id,
          symbol: result.trade?.symbol,
          side: result.trade?.side,
          quantity: result.trade?.quantity,
          price: result.trade?.price,
          total: result.trade?.total,
          fee: result.trade?.fee,
        };
      }

      case 'feed:get': {
        const feeds = getFeedItems({ limit: params.limit || 10 });
        return feeds.map(f => ({
          type: f.type,
          title: f.title,
          symbol: f.symbol,
          importance: f.importance,
          timestamp: f.timestamp,
        }));
      }

      default:
        return { error: `未知 Skill: ${skill}` };
    }
  }

  // ========== 辅助方法 ==========

  private extractSymbol(input: string): string | null {
    const match = input.match(/\b(BTC|DOGE|ETH|SOL|XRP|ADA)\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  private parseTradeIntent(input: string): { symbol: string | null; side: 'buy' | 'sell' | null; amount: number } {
    const symbol = this.extractSymbol(input);
    const side = input.includes('买') || input.includes('buy') ? 'buy' : 
                 input.includes('卖') || input.includes('sell') ? 'sell' : null;
    
    // 提取金额
    const amountMatch = input.match(/(\d+)\s*(USDT|USD|u)?/i);
    const amount = amountMatch ? parseInt(amountMatch[1]) : 100;

    return { symbol, side, amount };
  }

  private formatAnalysisReply(symbol: string, analysis: any): string {
    if (analysis.error) {
      return `❌ ${symbol} 分析失败: ${analysis.error}`;
    }
    
    let reply = `📊 **${symbol} 市场分析**\n\n`;
    reply += `RSI: ${analysis.rsi}\n`;
    reply += `趋势: ${analysis.trend}\n\n`;
    reply += `信号:\n`;
    analysis.signals.forEach((s: any) => {
      reply += `- ${s.description}\n`;
    });
    
    return reply;
  }

  private formatPortfolioReply(portfolio: any): string {
    let reply = `💰 **投资组合概况**\n\n`;
    reply += `总资产: $${portfolio.totalEquity.toFixed(2)}\n`;
    reply += `可用余额: $${portfolio.balance.toFixed(2)}\n\n`;
    
    if (portfolio.positions.length > 0) {
      reply += `持仓:\n`;
      portfolio.positions.forEach((p: any) => {
        const pnlEmoji = p.unrealizedPnl >= 0 ? '🟢' : '🔴';
        reply += `${pnlEmoji} ${p.symbol}: ${p.quantity.toFixed(6)} @ $${p.avgPrice.toFixed(2)}\n`;
      });
    } else {
      reply += '暂无持仓';
    }
    
    return reply;
  }

  private formatTradeReply(
    symbol: string, 
    side: string, 
    amount: number, 
    trade: any, 
    analysis: any
  ): string {
    if (trade.error) {
      return `❌ 交易失败: ${trade.error}`;
    }

    const sideText = side === 'buy' ? '买入' : '卖出';
    const emoji = side === 'buy' ? '🟢' : '🔴';
    
    let reply = `${emoji} **${sideText} ${symbol} 成功**\n\n`;
    reply += `数量: ${trade.quantity.toFixed(6)} ${symbol}\n`;
    reply += `价格: $${trade.price}\n`;
    reply += `总额: $${trade.total}\n`;
    reply += `手续费: $${trade.fee}\n\n`;
    reply += `💡 **交易理由**: ${analysis.summary || '技术分析信号'}\n`;
    reply += `📝 交易 ID: ${trade.id}`;
    
    return reply;
  }

  private formatFeedReply(feeds: any[]): string {
    if (feeds.length === 0) {
      return '📭 暂无最新情报';
    }

    let reply = `📰 **最新市场情报**\n\n`;
    feeds.slice(0, 5).forEach((f, i) => {
      const importance = f.importance === 'critical' ? '🔴' : f.importance === 'high' ? '🟠' : '⚪';
      reply += `${importance} ${f.title}\n`;
    });
    
    return reply;
  }
}

// 单例导出
let paInstance: PAAgent | null = null;

export function getPAAgent(config?: Partial<PAConfig>): PAAgent {
  if (!paInstance) {
    paInstance = new PAAgent(config);
  }
  return paInstance;
}

export default PAAgent;
