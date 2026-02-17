/**
 * 模拟交易 Skill
 * 
 * 最简单的交易执行 Skill，用于测试和开发：
 * 1. 接收交易指令
 * 2. 调用 PortfolioManager 执行
 * 3. 返回结果
 * 
 * 无策略判断，无复杂风控，只执行 PA 的决策
 */

import type { Skill, SkillContext, SkillResult } from '../types';

export interface TradeInstruction {
  symbol: string;           // 币种，如 "BTC"
  side: 'buy' | 'sell';     // 买入或卖出
  amount?: number;          // 买入金额 (USD)，buy 时优先使用
  quantity?: number;        // 卖出数量，sell 时必须提供
  reason?: string;          // 交易原因 (可选，用于记录)
}

export const SimulationTradeSkill: Skill = {
  // ========== 元数据 ==========
  id: 'simulation:trade',
  name: '模拟交易执行',
  description: '在模拟环境中执行交易，使用虚拟资金',
  category: 'utility',
  version: '1.0.0',

  // ========== 核心指令 ==========
  instructions: {
    system: `你是模拟交易执行器。你的职责是准确执行 PA 发出的交易指令。

执行流程:
1. 验证指令参数完整
2. 获取当前市场价格
3. 如果是买入：amount / price = quantity
4. 如果是卖出：直接使用 quantity
5. 调用 Portfolio 执行交易
6. 返回交易结果

注意事项:
- 只做执行，不做策略判断
- 如果资金/持仓不足，返回明确错误
- 记录交易原因以便追踪`,

    context: '在模拟环境中工作，使用虚拟 USDT 和虚拟持仓。',
  },

  // ========== 工具依赖 ==========
  tools: {
    required: [
      'portfolio:trade',      // 执行交易
      'coingecko:price',      // 获取价格
    ],
  },

  // ========== 输入/输出模式 ==========
  inputSchema: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: '交易币种，如 BTC' },
      side: { type: 'string', enum: ['buy', 'sell'], description: '买入或卖出' },
      amount: { type: 'number', description: '买入金额 (USD)，买入时必填' },
      quantity: { type: 'number', description: '卖出数量，卖出时必填' },
      reason: { type: 'string', description: '交易原因 (可选)' },
    },
    required: ['symbol', 'side'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
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
      portfolio: {
        type: 'object',
        properties: {
          totalEquity: { type: 'number' },
          balance: { type: 'number' },
        },
      },
      error: { type: 'string' },
    },
  },

  // ========== 执行函数 ==========
  execute: async (context: SkillContext): Promise<SkillResult> => {
    const { input, tools } = context;
    const startTime = Date.now();

    try {
      // 1. 参数验证
      const { symbol, side, amount, quantity, reason } = input as TradeInstruction;

      if (!symbol || !side) {
        return {
          success: false,
          error: '缺少必要参数: symbol, side',
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // 2. 获取当前价格
      const priceTool = tools.get('coingecko:price');
      if (!priceTool) {
        return {
          success: false,
          error: '价格工具不可用',
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      const price = await priceTool.execute({ symbol });
      if (!price || price <= 0) {
        return {
          success: false,
          error: `无法获取 ${symbol} 的有效价格`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // 3. 计算交易数量
      let tradeQuantity: number;
      if (side === 'buy') {
        if (!amount || amount <= 0) {
          return {
            success: false,
            error: '买入时必须提供有效的 amount (USD)',
            metadata: { executionTime: Date.now() - startTime },
          };
        }
        tradeQuantity = amount / price;
      } else {
        if (!quantity || quantity <= 0) {
          return {
            success: false,
            error: '卖出时必须提供有效的 quantity',
            metadata: { executionTime: Date.now() - startTime },
          };
        }
        tradeQuantity = quantity;
      }

      // 4. 执行交易
      const tradeTool = tools.get('portfolio:trade');
      if (!tradeTool) {
        return {
          success: false,
          error: '交易工具不可用',
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      const result = await tradeTool.execute({
        symbol: symbol.toUpperCase(),
        side,
        type: 'market',
        quantity: tradeQuantity,
        notes: reason || `${side.toUpperCase()} ${symbol}`,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || '交易执行失败',
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // 5. 获取更新后的 Portfolio
      const portfolioTool = tools.get('portfolio:get');
      const portfolio = portfolioTool ? await portfolioTool.execute({}) : null;

      // 6. 返回成功结果
      return {
        success: true,
        data: {
          trade: {
            id: result.trade.id,
            symbol: result.trade.symbol,
            side: result.trade.side,
            quantity: result.trade.quantity,
            price: result.trade.price,
            total: result.trade.total,
            fee: result.trade.fee,
            timestamp: result.trade.createdAt,
          },
          portfolio: portfolio ? {
            totalEquity: portfolio.totalEquity,
            balance: portfolio.balance,
          } : null,
        },
        metadata: {
          executionTime: Date.now() - startTime,
          toolsUsed: ['coingecko:price', 'portfolio:trade'],
        },
      };

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

export default SimulationTradeSkill;
