/**
 * 交易执行 Skill
 * 
 * PA 的核心交易能力，支持:
 * 1. 买入/卖出交易执行
 * 2. 自动风控检查
 * 3. 持仓管理
 * 4. 交易记录追踪
 */

import type { Skill, SkillContext, SkillResult } from '../types';

export interface TradingOrder {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity?: number;        // 指定数量
  amount?: number;          // 指定金额 (USD)
  price?: number;           // 限价单价格
  reason: string;           // 交易理由
  confidence: number;       // 置信度 (0-1)
  source: string;           // 信号来源 (e.g., "tech-analysis", "pa-decision")
}

export interface TradingConfig {
  enabled: boolean;
  maxSingleTradeAmount: number;    // 最大单笔金额
  maxDailyTradeCount: number;      // 日最大交易次数
  minConfidence: number;           // 最低置信度
  allowBuy: boolean;
  allowSell: boolean;
  stopLossPercent: number;
  takeProfitPercent: number;
  blacklist: string[];
  tradingHours?: {
    start: string;  // "09:00"
    end: string;    // "23:00"
  };
}

export const TradingSkill: Skill = {
  // ========== 元数据 ==========
  id: 'trading:execute',
  name: '交易执行',
  description: '执行加密货币买入/卖出交易，包含完整风控检查',
  category: 'strategist',
  version: '1.0.0',

  // ========== 核心指令 ==========
  instructions: {
    system: `你是交易执行专家。你的任务是安全、高效地执行交易指令。

执行流程:
1. 风控检查 - 验证交易是否合规
2. 价格获取 - 获取当前市场价格
3. 数量计算 - 根据金额或指定数量计算
4. 执行交易 - 调用 Portfolio 执行
5. 记录结果 - 记录交易到历史

风控规则:
- 置信度 >= 配置阈值
- 交易金额 <= 单笔限额
- 日交易次数 <= 限制
- 不在黑名单中
- 在允许的交易时间段内

输出规范:
- success: 是否执行成功
- trade: 交易详情（如果成功）
- riskChecks: 所有风控检查项及结果`,

    context: '你在 CryptoPulse 系统中工作，接收 PA 的交易决策，负责实际执行并确保风险可控。',

    reasoning: `交易决策流程:
1. 验证订单参数完整性
2. 检查全局配置（是否启用自动交易）
3. 检查风控规则:
   - 置信度检查: confidence >= minConfidence
   - 金额检查: amount <= maxSingleTradeAmount
   - 频次检查: dailyCount < maxDailyTradeCount
   - 黑名单检查: symbol not in blacklist
   - 时间检查: currentTime in tradingHours
4. 获取最新价格
5. 计算交易数量
6. 执行交易
7. 更新日交易计数
8. 记录执行日志`,

    constraints: [
      '必须所有风控检查通过才执行',
      '市价单使用当前市场价格',
      '记录每笔交易的决策来源和置信度',
      '失败时返回明确的风控原因',
    ],
  },

  // ========== 工具依赖 ==========
  tools: {
    required: [
      'portfolio:execute_trade',
      'coingecko:get_price',
    ],
    optional: [
      'portfolio:get_positions',
      'risk:check_limits',
    ],
  },

  // ========== 输入/输出模式 ==========
  inputSchema: {
    type: 'object',
    properties: {
      action: { 
        type: 'string', 
        enum: ['buy', 'sell', 'get_positions', 'get_config'],
        description: '交易操作类型',
      },
      symbol: { type: 'string', description: '交易币种' },
      amount: { type: 'number', description: '买入金额 (USD)' },
      quantity: { type: 'number', description: '卖出数量' },
      confidence: { type: 'number', description: '置信度 0-1' },
      reason: { type: 'string', description: '交易理由' },
    },
  },

  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      action: { type: 'string', enum: ['buy', 'sell', 'get_positions', 'get_config'] },
      trade: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          symbol: { type: 'string' },
          side: { type: 'string' },
          quantity: { type: 'number' },
          price: { type: 'number' },
          total: { type: 'number' },
          fee: { type: 'number' },
          timestamp: { type: 'string' },
        },
      },
      riskChecks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            passed: { type: 'boolean' },
            reason: { type: 'string' },
          },
        },
      },
      portfolio: {
        type: 'object',
        properties: {
          totalEquity: { type: 'number' },
          balance: { type: 'number' },
          positions: { type: 'array' },
        },
      },
      config: { type: 'object' },
    },
  },

  // ========== 参考资料 ==========
  references: {
    examples: [
      {
        input: {
          action: 'buy',
          symbol: 'BTC',
          amount: 500,
          confidence: 0.85,
          reason: '技术指标显示金叉，RSI 健康',
        },
        output: {
          success: true,
          action: 'buy',
          trade: {
            id: 'trade-xxx',
            symbol: 'BTC',
            side: 'buy',
            quantity: 0.0073,
            price: 68450.5,
            total: 500,
            fee: 0.5,
          },
          riskChecks: [
            { name: '置信度检查', passed: true },
            { name: '金额限制', passed: true },
            { name: '日频次', passed: true },
          ],
        },
        explanation: '标准买入流程，通过所有风控检查',
      },
      {
        input: {
          action: 'sell',
          symbol: 'BTC',
          quantity: 0.005,
          confidence: 0.75,
          reason: '达到止盈目标',
        },
        output: {
          success: true,
          action: 'sell',
          trade: {
            id: 'trade-yyy',
            symbol: 'BTC',
            side: 'sell',
            quantity: 0.005,
            price: 69100.0,
            total: 345.5,
            fee: 0.35,
            realizedPnl: 25.5,
          },
        },
        explanation: '卖出持仓的一部分，实现盈利',
      },
    ],
  },

  // ========== 执行函数 ==========
  execute: async (context: SkillContext): Promise<SkillResult> => {
    const { input, tools } = context;
    const startTime = Date.now();

    try {
      // 获取配置（默认配置）
      const tradingConfig: TradingConfig = {
        enabled: true,
        maxSingleTradeAmount: 1000,
        maxDailyTradeCount: 5,
        minConfidence: 0.7,
        allowBuy: true,
        allowSell: true,
        stopLossPercent: 5,
        takeProfitPercent: 10,
        blacklist: [],
        tradingHours: undefined,
      };

      // 处理不同 action
      switch (input.action) {
        case 'buy':
          return await executeBuy(input, tradingConfig, tools);
        case 'sell':
          return await executeSell(input, tradingConfig, tools);
        case 'get_positions':
          return await getPositions(tools);
        case 'get_config':
          return {
            success: true,
            data: { config: tradingConfig },
          };
        default:
          return {
            success: false,
            error: `未知 action: ${input.action}`,
          };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMsg,
        metadata: { executionTime: Date.now() - startTime },
      };
    }
  },
};

// ========== 内部实现函数 ==========

async function executeBuy(
  input: any,
  config: TradingConfig,
  tools: SkillContext['tools']
): Promise<SkillResult> {
  const riskChecks: Array<{ name: string; passed: boolean; reason?: string }> = [];

  // 1. 检查是否启用
  riskChecks.push({
    name: '自动交易开关',
    passed: config.enabled,
    reason: config.enabled ? undefined : '自动交易已禁用',
  });

  // 2. 检查买入权限
  riskChecks.push({
    name: '买入权限',
    passed: config.allowBuy,
    reason: config.allowBuy ? undefined : '买入功能已禁用',
  });

  // 3. 置信度检查
  const confidencePass = input.confidence >= config.minConfidence;
  riskChecks.push({
    name: '置信度检查',
    passed: confidencePass,
    reason: confidencePass
      ? undefined
      : `置信度 ${(input.confidence * 100).toFixed(0)}% 低于阈值 ${(config.minConfidence * 100).toFixed(0)}%`,
  });

  // 4. 金额检查
  const amountPass = input.amount <= config.maxSingleTradeAmount;
  riskChecks.push({
    name: '金额限制',
    passed: amountPass,
    reason: amountPass
      ? undefined
      : `金额 $${input.amount} 超过限额 $${config.maxSingleTradeAmount}`,
  });

  // 5. 黑名单检查
  const blacklistPass = !config.blacklist.includes(input.symbol.toUpperCase());
  riskChecks.push({
    name: '黑名单检查',
    passed: blacklistPass,
    reason: blacklistPass ? undefined : `${input.symbol} 在交易黑名单中`,
  });

  // 6. 交易时间检查
  if (config.tradingHours) {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const timePass = currentTime >= config.tradingHours.start && currentTime <= config.tradingHours.end;
    riskChecks.push({
      name: '交易时间',
      passed: timePass,
      reason: timePass ? undefined : `当前时间 ${currentTime} 不在允许范围 ${config.tradingHours.start}-${config.tradingHours.end}`,
    });
  }

  // 检查是否全部通过
  const allPassed = riskChecks.every((check) => check.passed);
  if (!allPassed) {
    return {
      success: false,
      data: {
        action: 'buy',
        symbol: input.symbol,
        riskChecks,
        blockedBy: riskChecks.filter((c) => !c.passed).map((c) => c.name),
      },
      error: `风控拦截: ${riskChecks.filter((c) => !c.passed).map((c) => c.reason).join(', ')}`,
    };
  }

  // 获取当前价格
  const priceTool = tools.get('coingecko:get_price');
  const currentPrice = priceTool
    ? await priceTool.execute({ symbol: input.symbol })
    : null;

  if (!currentPrice) {
    return {
      success: false,
      error: `无法获取 ${input.symbol} 的当前价格`,
    };
  }

  // 计算数量
  const quantity = input.amount / currentPrice;

  // 执行交易
  const tradeTool = tools.get('portfolio:execute_trade');
  if (!tradeTool) {
    return {
      success: false,
      error: '交易工具不可用',
    };
  }

  const tradeResult = await tradeTool.execute({
    symbol: input.symbol,
    side: 'buy',
    type: 'market',
    quantity,
    notes: `${input.reason} | 置信度: ${(input.confidence * 100).toFixed(0)}%`,
  });

  if (!tradeResult.success) {
    return {
      success: false,
      error: tradeResult.error || '交易执行失败',
      data: { riskChecks },
    };
  }

  return {
    success: true,
    data: {
      action: 'buy',
      trade: tradeResult.trade,
      riskChecks,
    },
  };
}

async function executeSell(
  input: any,
  config: TradingConfig,
  tools: SkillContext['tools']
): Promise<SkillResult> {
  // 类似 executeBuy 的逻辑，检查卖出权限
  const riskChecks: Array<{ name: string; passed: boolean; reason?: string }> = [];

  riskChecks.push({
    name: '自动交易开关',
    passed: config.enabled,
    reason: config.enabled ? undefined : '自动交易已禁用',
  });

  riskChecks.push({
    name: '卖出权限',
    passed: config.allowSell,
    reason: config.allowSell ? undefined : '卖出功能已禁用',
  });

  const confidencePass = input.confidence >= config.minConfidence;
  riskChecks.push({
    name: '置信度检查',
    passed: confidencePass,
    reason: confidencePass
      ? undefined
      : `置信度 ${(input.confidence * 100).toFixed(0)}% 低于阈值`,
  });

  const allPassed = riskChecks.every((check) => check.passed);
  if (!allPassed) {
    return {
      success: false,
      data: { action: 'sell', symbol: input.symbol, riskChecks },
      error: `风控拦截`,
    };
  }

  // 执行卖出
  const tradeTool = tools.get('portfolio:execute_trade');
  if (!tradeTool) {
    return {
      success: false,
      error: '交易工具不可用',
    };
  }

  const tradeResult = await tradeTool.execute({
    symbol: input.symbol,
    side: 'sell',
    type: 'market',
    quantity: input.quantity,
    notes: `${input.reason} | 置信度: ${(input.confidence * 100).toFixed(0)}%`,
  });

  if (!tradeResult.success) {
    return {
      success: false,
      error: tradeResult.error || '交易执行失败',
    };
  }

  return {
    success: true,
    data: {
      action: 'sell',
      trade: tradeResult.trade,
      riskChecks,
    },
  };
}

async function getPositions(tools: SkillContext['tools']): Promise<SkillResult> {
  const portfolioTool = tools.get('portfolio:get_portfolio');
  if (!portfolioTool) {
    return {
      success: false,
      error: 'Portfolio 工具不可用',
    };
  }

  const portfolio = await portfolioTool.execute({});

  return {
    success: true,
    data: {
      action: 'get_positions',
      portfolio: {
        totalEquity: portfolio.totalEquity,
        balance: portfolio.balance,
        positions: portfolio.positions,
        totalUnrealizedPnl: portfolio.totalUnrealizedPnl,
        totalRealizedPnl: portfolio.totalRealizedPnl,
      },
    },
  };
}

export default TradingSkill;
