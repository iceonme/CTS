/**
 * Technical Analyst - 技术分析员
 * 
 * 一个受限的专业 Agent：
 * 1. 低自主性，不能动态发现 Skills
 * 2. 只能回答技术分析相关问题
 * 3. 超出范围时直接拒绝
 * 4. 被动响应，不支持主动任务
 */

import { BaseAgent } from '@/lib/core/base-agent';
import type {
  AgentConfig,
  ChatContext,
  ChatResponse,
} from '@/lib/core/types';

// ========== 技术分析员配置 ==========

const TECH_ANALYST_CONFIG: AgentConfig = {
  identity: {
    id: 'tech-analyst',
    name: '技术分析员',
    role: 'Technical Analyst',
    personality: '严谨、数据驱动、不善言辞',
    background: '专注于技术指标分析，只看图表和数据，不做情绪判断',
  },
  prompts: {
    system: `你是技术分析员，只专注于技术指标分析。

你的职责：
1. 分析 RSI、MACD、均线等技术指标
2. 识别图表形态和支撑阻力位
3. 基于数据给出客观分析

你**不会**：
- 讨论基本面或新闻
- 给出买入/卖出建议（这是 PA 的职责）
- 回答与技术分析无关的问题`,
    constraints: [
      '只回答技术分析相关问题',
      '不提供投资建议',
      '不讨论基本面',
      '超出范围时明确拒绝',
    ],
  },
  capabilities: {
    baseSkills: [
      'analysis:technical',    // 深度技术分析
      'analysis:rsi',          // RSI 指标
      'analysis:trend',        // 趋势分析
    ],
    extendableSkills: [],      // 不能动态添加 Skills
    memoryAccess: {
      session: true,
      individual: true,
      collective: true,        // 可以读取集体记忆中的技术信号
    },
  },
  behavior: {
    autonomy: 'low',           // 低自主性
    outOfScopeStrategy: 'reject',  // 超出范围直接拒绝
    proactiveEnabled: false,   // 不支持主动任务
    canUseDynamicSkills: false,
  },
  isPrimary: false,
};

// ========== 技术分析员实现 ==========

export class TechnicalAnalyst extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    const mergedConfig: AgentConfig = {
      ...TECH_ANALYST_CONFIG,
      ...config,
      identity: { ...TECH_ANALYST_CONFIG.identity, ...config?.identity },
      prompts: { ...TECH_ANALYST_CONFIG.prompts, ...config?.prompts },
      capabilities: { ...TECH_ANALYST_CONFIG.capabilities, ...config?.capabilities },
      behavior: { ...TECH_ANALYST_CONFIG.behavior, ...config?.behavior },
      isPrimary: false,
    };
    super(mergedConfig);
  }

  /**
   * 主对话入口
   */
  async chat(message: string, context?: ChatContext): Promise<ChatResponse> {
    // 记录用户消息
    this.memory.session.addMessage('user', message);

    // 检查是否在范围内
    const scopeCheck = this.checkScope(message);
    if (!scopeCheck.inScope) {
      const response = this.handleOutOfScope(message);
      this.memory.session.addMessage('assistant', response.content);
      return response;
    }

    // 解析意图
    const intent = this.parseIntent(message);

    // 执行分析
    let response: ChatResponse;
    try {
      switch (intent.type) {
        case 'rsi':
          response = await this.handleRSIQuery(intent.symbol);
          break;
        case 'trend':
          response = await this.handleTrendQuery(intent.symbol);
          break;
        case 'comprehensive':
          response = await this.handleComprehensiveAnalysis(intent.symbol);
          break;
        default:
          response = await this.handleGeneralTechnicalQuery(message);
      }
    } catch (error) {
      response = {
        content: `分析失败：${error instanceof Error ? error.message : '未知错误'}`,
      };
    }

    // 记录回复
    this.memory.session.addMessage('assistant', response.content);

    // 更新统计
    this.memory.individual.updateStats({
      totalAnalyses: this.memory.individual.stats.totalAnalyses + 1,
    });

    return response;
  }

  /**
   * 覆盖范围检查 - 技术分析员只处理技术相关问题
   */
  protected checkScope(message: string): { inScope: boolean; reason?: string } {
    const technicalKeywords = [
      'rsi', 'macd', '均线', 'ma', '趋势', 'trend', '支撑', '阻力', 
      '分析', 'technical', '指标', 'indicator', '图表', 'chart',
      '突破', 'breakout', '回调', 'pullback', '超买', 'oversold',
      '超卖', 'overbought', '金叉', '死叉', '背离', 'divergence'
    ];
    
    const hasTechnicalKeyword = technicalKeywords.some(kw => 
      message.toLowerCase().includes(kw.toLowerCase())
    );

    if (!hasTechnicalKeyword) {
      return { 
        inScope: false, 
        reason: 'Message does not contain technical analysis keywords' 
      };
    }

    return { inScope: true };
  }

  /**
   * 解析技术相关的意图
   */
  private parseIntent(message: string): {
    type: 'rsi' | 'trend' | 'comprehensive' | 'general';
    symbol?: string;
  } {
    const lower = message.toLowerCase();
    const symbol = this.extractSymbol(lower) || 'BTC';

    if (/rsi/i.test(lower)) {
      return { type: 'rsi', symbol };
    }

    if (/趋势|trend|均线|ma/i.test(lower)) {
      return { type: 'trend', symbol };
    }

    if (/综合|全面|comprehensive|详细/i.test(lower)) {
      return { type: 'comprehensive', symbol };
    }

    return { type: 'general', symbol };
  }

  /**
   * 处理 RSI 查询
   */
  private async handleRSIQuery(symbol: string): Promise<ChatResponse> {
    // 执行 RSI 分析 Skill
    const result = await this.executeSkill('analysis:rsi', { symbol });

    let content = `📊 **${symbol} RSI 分析**\n\n`;
    content += `当前 RSI: ${result.rsi?.toFixed(2) || 'N/A'}\n`;
    content += `状态: ${this.getRSIStatus(result.rsi)}\n\n`;
    
    if (result.rsi > 70) {
      content += `⚠️ 超买区域，注意回调风险`;
    } else if (result.rsi < 30) {
      content += `⚠️ 超卖区域，可能存在反弹机会`;
    } else {
      content += `✓ 中性区域`;
    }

    // 记录到个体记忆
    this.memory.individual.addExperience({
      type: 'analysis',
      content: `RSI analysis for ${symbol}: ${result.rsi?.toFixed(2)}`,
      result: 'success',
      metadata: { symbol, rsi: result.rsi },
    });

    return { content };
  }

  /**
   * 处理趋势查询
   */
  private async handleTrendQuery(symbol: string): Promise<ChatResponse> {
    const result = await this.executeSkill('analysis:trend', { symbol });

    let content = `📈 **${symbol} 趋势分析**\n\n`;
    content += `短期趋势: ${result.shortTerm || 'N/A'}\n`;
    content += `中期趋势: ${result.mediumTerm || 'N/A'}\n`;
    content += `长期趋势: ${result.longTerm || 'N/A'}\n\n`;
    
    if (result.keyLevels) {
      content += `关键价位:\n`;
      content += `- 支撑位: $${result.keyLevels.support?.join(', $') || 'N/A'}\n`;
      content += `- 阻力位: $${result.keyLevels.resistance?.join(', $') || 'N/A'}\n`;
    }

    return { content };
  }

  /**
   * 处理综合分析
   */
  private async handleComprehensiveAnalysis(symbol: string): Promise<ChatResponse> {
    // 受限 Agent：只能按顺序执行预设的 Skills，不能动态协调
    const [rsiResult, trendResult] = await this.executeSkills([
      { skillId: 'analysis:rsi', params: { symbol } },
      { skillId: 'analysis:trend', params: { symbol } },
    ]);

    let content = `📊 **${symbol} 技术分析报告**\n\n`;
    
    content += `【RSI】\n`;
    content += `数值: ${rsiResult.rsi?.toFixed(2) || 'N/A'}\n`;
    content += `状态: ${this.getRSIStatus(rsiResult.rsi)}\n\n`;
    
    content += `【趋势】\n`;
    content += `短期: ${trendResult.shortTerm || 'N/A'}\n`;
    content += `中期: ${trendResult.mediumTerm || 'N/A'}\n\n`;
    
    content += `【客观数据】\n`;
    content += `本分析仅供参考，不构成投资建议。\n`;
    content += `如需交易建议，请咨询 PA。`;

    return { content };
  }

  /**
   * 处理一般技术查询
   */
  private async handleGeneralTechnicalQuery(message: string): Promise<ChatResponse> {
    const symbol = this.extractSymbol(message) || 'BTC';
    
    // 默认返回基础技术指标
    return this.handleComprehensiveAnalysis(symbol);
  }

  // ========== 辅助方法 ==========

  private extractSymbol(input: string): string | undefined {
    const match = input.match(/\b(btc|eth|doge|sol|xrp|ada)\b/i);
    return match ? match[0].toUpperCase() : undefined;
  }

  private getRSIStatus(rsi: number): string {
    if (rsi > 80) return '严重超买';
    if (rsi > 70) return '超买';
    if (rsi > 60) return '偏强';
    if (rsi > 40) return '中性';
    if (rsi > 30) return '偏弱';
    if (rsi > 20) return '超卖';
    return '严重超卖';
  }
}

// ========== 单例导出 ==========

let techAnalystInstance: TechnicalAnalyst | null = null;

export function getTechnicalAnalyst(config?: Partial<AgentConfig>): TechnicalAnalyst {
  if (!techAnalystInstance) {
    techAnalystInstance = new TechnicalAnalyst(config);
  }
  return techAnalystInstance;
}

export default TechnicalAnalyst;
