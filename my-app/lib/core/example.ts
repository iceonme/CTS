/**
 * TradeMind Framework - 使用示例
 * 
 * 展示如何创建和使用 BaseAgent 及其子类
 */

import { BaseAgent } from './base-agent';
import type { SkillDefinition, AgentConfig } from './types';
import { getPA } from '@/lib/agents/pa';
import { getTechnicalAnalyst } from '@/lib/agents/tech-analyst';

// ========== 1. 注册全局 Skills ==========

const marketAnalysisSkill: SkillDefinition = {
  id: 'analysis:market',
  name: '市场分析',
  description: '分析指定币种的市场情况，返回价格、RSI、趋势等数据',
  parameters: [
    { name: 'symbol', type: 'string', required: true, description: '币种代码，如 BTC' },
  ],
  handler: async (params, context) => {
    // 模拟调用 CoinGecko API
    return {
      symbol: params.symbol,
      price: 68400,
      rsi: 62,
      trend: 'up',
      signals: [
        { type: 'rsi', description: 'RSI 处于中性偏强区间' },
        { type: 'price', description: '突破 24h 高点' },
      ],
    };
  },
};

const rsiSkill: SkillDefinition = {
  id: 'analysis:rsi',
  name: 'RSI 分析',
  description: '计算 RSI 指标',
  parameters: [
    { name: 'symbol', type: 'string', required: true, description: '币种代码' },
  ],
  handler: async (params) => {
    return { symbol: params.symbol, rsi: 62, status: 'neutral' };
  },
};

const trendSkill: SkillDefinition = {
  id: 'analysis:trend',
  name: '趋势分析',
  description: '分析价格趋势',
  parameters: [
    { name: 'symbol', type: 'string', required: true, description: '币种代码' },
  ],
  handler: async (params) => {
    return { 
      symbol: params.symbol, 
      shortTerm: 'up', 
      mediumTerm: 'sideways',
      keyLevels: { support: [65000, 62000], resistance: [70000, 72000] }
    };
  },
};

const portfolioGetSkill: SkillDefinition = {
  id: 'portfolio:get',
  name: '查看持仓',
  description: '获取当前投资组合',
  parameters: [],
  handler: async () => {
    return {
      totalEquity: 10000,
      balance: 5000,
      positions: [
        { symbol: 'BTC', quantity: 0.05, avgPrice: 68000, unrealizedPnl: 200 },
      ],
    };
  },
};

const portfolioTradeSkill: SkillDefinition = {
  id: 'portfolio:trade',
  name: '执行交易',
  description: '在模拟环境中执行交易',
  parameters: [
    { name: 'symbol', type: 'string', required: true, description: '币种' },
    { name: 'side', type: 'string', required: true, description: 'buy 或 sell' },
    { name: 'amount', type: 'number', required: true, description: '金额' },
    { name: 'reason', type: 'string', required: false, description: '交易理由' },
  ],
  handler: async (params) => {
    const mockPrices: Record<string, number> = { BTC: 68400, ETH: 3500, DOGE: 0.1 };
    const price = mockPrices[params.symbol] || 100;
    const quantity = params.amount / price;
    
    return {
      id: 'trade-' + Date.now(),
      symbol: params.symbol,
      side: params.side,
      quantity,
      price,
      total: params.amount,
      fee: params.amount * 0.001,
    };
  },
};

const feedGetSkill: SkillDefinition = {
  id: 'feed:get',
  name: '获取情报',
  description: '获取最新市场情报',
  parameters: [
    { name: 'limit', type: 'number', required: false, description: '数量限制' },
  ],
  handler: async (params) => {
    return [
      { type: 'technical', title: 'BTC 突破 68k', importance: 'high', timestamp: Date.now() },
      { type: 'polymarket', title: 'ETF 通过概率上升', importance: 'medium', timestamp: Date.now() },
    ].slice(0, params.limit || 10);
  },
};

// 注册所有 Skills
BaseAgent.registerSkill(marketAnalysisSkill);
BaseAgent.registerSkill(rsiSkill);
BaseAgent.registerSkill(trendSkill);
BaseAgent.registerSkill(portfolioGetSkill);
BaseAgent.registerSkill(portfolioTradeSkill);
BaseAgent.registerSkill(feedGetSkill);

// ========== 2. 使用示例 ==========

export async function example() {
  console.log('=== TradeMind Framework 使用示例 ===\n');

  // 获取 PA 实例
  const pa = getPA();
  
  // 获取技术分析员实例
  const techAnalyst = getTechnicalAnalyst();

  // --- 示例 1: 与 PA 对话 ---
  console.log('--- 示例 1: 与 PA 对话 ---');
  
  console.log('\n用户: 分析 BTC');
  const paResponse1 = await pa.chat('分析 BTC');
  console.log(`PA: ${paResponse1.content}`);
  if (paResponse1.thinking) {
    console.log(`\nPA 的思考过程:\n${paResponse1.thinking}`);
  }

  console.log('\n用户: 买入 500 USDT 的 BTC');
  const paResponse2 = await pa.chat('买入 500 USDT 的 BTC');
  console.log(`PA: ${paResponse2.content}`);

  console.log('\n用户: 我的资产');
  const paResponse3 = await pa.chat('我的资产');
  console.log(`PA: ${paResponse3.content}`);

  // --- 示例 2: 与技术分析师对话（范围内）---
  console.log('\n\n--- 示例 2: 与技术分析师对话（范围内）---');
  
  console.log('\n用户: BTC 的 RSI 是多少？');
  const techResponse1 = await techAnalyst.chat('BTC 的 RSI 是多少？');
  console.log(`技术分析员: ${techResponse1.content}`);

  console.log('\n用户: 详细分析 ETH');
  const techResponse2 = await techAnalyst.chat('详细分析 ETH');
  console.log(`技术分析员: ${techResponse2.content}`);

  // --- 示例 3: 与技术分析师对话（超出范围）---
  console.log('\n\n--- 示例 3: 与技术分析师对话（超出范围）---');
  
  console.log('\n用户: 讲个笑话');
  const techResponse3 = await techAnalyst.chat('讲个笑话');
  console.log(`技术分析员: ${techResponse3.content}`);

  console.log('\n用户: 我该不该买 BTC？');
  const techResponse4 = await techAnalyst.chat('我该不该买 BTC？');
  console.log(`技术分析员: ${techResponse4.content}`);

  // --- 示例 4: PA 的自主性 ---
  console.log('\n\n--- 示例 4: PA 的自主性 ---');
  
  console.log(`\nPA 是否主对象: ${pa.isPrimary}`);
  console.log(`PA 自主性级别: ${pa.autonomy}`);
  console.log(`PA 可用 Skills: ${pa.getAvailableSkills().join(', ')}`);
  
  console.log(`\n技术分析员是否主对象: ${techAnalyst.isPrimary}`);
  console.log(`技术分析员自主性级别: ${techAnalyst.autonomy}`);
  console.log(`技术分析员可用 Skills: ${techAnalyst.getAvailableSkills().join(', ')}`);

  console.log('\n\n=== 示例结束 ===');
}

// 如果直接运行此文件
if (require.main === module) {
  example().catch(console.error);
}
