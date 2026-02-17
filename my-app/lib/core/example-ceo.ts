/**
 * TradeMind Framework - CEO PA 使用示例
 * 
 * 演示三层 Feed 设计：
 * 1. Feed 总线：Agent 发布结构化情报
 * 2. PA.processFeed()：自动触发 OODA Loop 决策
 * 3. feed:get Skill：用户主动查询
 */

import { PA, getPA } from '@/lib/agents/pa';
import { BaseAgent } from './base-agent';
import { feedBus, createFeed } from './feed';
import type { SkillDefinition } from './types';

// ========== 注册必要的 Skills ==========

const feedGetSkill: SkillDefinition = {
  id: 'feed:get',
  name: '获取情报',
  description: '获取最新市场情报 Feed',
  parameters: [{ name: 'limit', type: 'number', required: false, description: '数量限制' }],
  handler: async (params) => {
    return feedBus.query({ limit: params.limit || 10 });
  },
};

const portfolioGetSkill: SkillDefinition = {
  id: 'portfolio:get',
  name: '查看持仓',
  description: '获取当前投资组合',
  parameters: [],
  handler: async () => ({
    totalEquity: 10000,
    balance: 5000,
    positions: [{ symbol: 'BTC', quantity: 0.05, avgPrice: 68000, unrealizedPnl: 200 }],
  }),
};

const setTargetPositionSkill: SkillDefinition = {
  id: 'set_target_position',
  name: '设置目标仓位',
  description: '设置目标仓位比例，系统自动计算交易数量',
  parameters: [
    { name: 'symbol', type: 'string', required: true, description: '币种' },
    { name: 'target_percent', type: 'number', required: true, description: '目标仓位比例 0-1' },
    { name: 'reason', type: 'string', required: false, description: '理由' },
  ],
  handler: async (params, context) => {
    console.log(`[Execution] Setting ${params.symbol} target to ${(params.target_percent * 100).toFixed(0)}%`);
    return { success: true, symbol: params.symbol, targetPercent: params.target_percent };
  },
};

const addToWatchlistSkill: SkillDefinition = {
  id: 'add_to_watchlist',
  name: '加入观察列表',
  description: '加入重点监控',
  parameters: [
    { name: 'symbol', type: 'string', required: true, description: '币种' },
    { name: 'reason', type: 'string', required: false, description: '理由' },
  ],
  handler: async (params) => ({ success: true, symbol: params.symbol, status: 'watching' }),
};

// 注册所有 Skills
BaseAgent.registerSkill(feedGetSkill);
BaseAgent.registerSkill(portfolioGetSkill);
BaseAgent.registerSkill(setTargetPositionSkill);
BaseAgent.registerSkill(addToWatchlistSkill);

// ========== 示例场景 ==========

export async function runCEOExample() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  TradeMind CEO PA - 三层 Feed 设计演示');
  console.log('═══════════════════════════════════════════════════\n');

  // 初始化 PA
  const pa = getPA();
  pa.setAutoExecute(true);  // 开启自动执行（演示用）
  pa.setConfidenceThreshold(75);

  // ═══════════════════════════════════════════════════
  // 第一层：Feed 总线 - Agent 发布结构化情报
  // ═══════════════════════════════════════════════════
  console.log('【第一层】Feed 总线 - Agent 发布结构化情报\n');

  // Technical Agent 发布突破信号
  const techFeed = createFeed('technical', 'signal', 'high', {
    symbol: 'BTC',
    signalType: 'breakout',
    strength: 0.85,
    indicators: { rsi: 72, trend: 'up', macd: { value: 150, signal: 100, histogram: 50 } },
    price: { current: 68500, entry: 68500, stopLoss: 66000, takeProfit: 72000 },
    timeframe: '1h',
    description: 'BTC 突破 68k 关键阻力位，成交量放大',
  });
  feedBus.publish(techFeed);
  console.log('📊 Technical Agent 发布:', techFeed.data.description);
  await delay(100);

  // Polymarket Agent 发布概率变化（注意：这是诱多信号！）
  const polyFeed = createFeed('poly', 'analysis', 'high', {
    event: 'BTC 本月突破 70k',
    symbol: 'BTC',
    probability: 0.35,
    probabilityDelta: -0.15,  // 概率下降！
    volume: 500000,
    liquidity: 2000000,
    description: '尽管价格上涨，但预测市场显示突破概率从 50% 降至 35%',
  });
  feedBus.publish(polyFeed);
  console.log('🎯 Polymarket Agent 发布:', polyFeed.data.description);
  console.log('   ⚠️ 关键信号：价格上涨但概率下降（诱多嫌疑）\n');
  await delay(100);

  // ═══════════════════════════════════════════════════
  // 第二层：PA 自动接收并处理 Feed
  // ═══════════════════════════════════════════════════
  console.log('【第二层】PA.processFeed() - OODA Loop 自动决策\n');

  // PA 应该自动处理这两个 Feed，进行 Bull/Bear 辩论
  console.log('PA 正在分析...\n');
  await delay(500);

  // 手动触发一次 processFeed 展示输出（实际会自动触发）
  const decision = await pa.processFeed(polyFeed);

  console.log('═══════════════════════════════════════════════════');
  console.log('  PA 决策输出 (结构化 JSON)');
  console.log('═══════════════════════════════════════════════════');
  console.log(JSON.stringify(decision, null, 2));
  console.log();

  // ═══════════════════════════════════════════════════
  // 第三层：用户主动查询 Feed
  // ═══════════════════════════════════════════════════
  console.log('【第三层】feed:get Skill - 用户主动查询\n');

  console.log('用户: "看看最新情报"');
  const chatResponse = await pa.chat('看看最新情报');
  console.log('PA:', chatResponse.content);
  console.log();

  // ═══════════════════════════════════════════════════
  // 场景 2：信号共振（买入）
  // ═══════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════');
  console.log('  场景 2：信号共振（Bullish Confluence）');
  console.log('═══════════════════════════════════════════════════\n');

  // Technical：金叉确认
  const techFeed2 = createFeed('technical', 'signal', 'high', {
    symbol: 'ETH',
    signalType: 'trend_confirm',
    strength: 0.8,
    indicators: { rsi: 55, trend: 'up' },
    price: { current: 3500 },
    timeframe: '4h',
    description: 'ETH 4小时金叉确认，RSI 健康',
  });
  feedBus.publish(techFeed2);
  console.log('📊 Technical:', techFeed2.data.description);

  // Macro：降息落地
  const macroFeed = createFeed('macro', 'event', 'critical', {
    regime: 'risk_on',
    drivers: ['Fed 降息 25bp', '流动性宽松'],
    narratives: ['加密市场迎来资金流入', 'DeFi 板块活跃'],
    description: '美联储宣布降息，风险资产普涨',
  });
  feedBus.publish(macroFeed);
  console.log('🌍 Macro:', macroFeed.data.description);

  // Poly：概率上升
  const polyFeed2 = createFeed('poly', 'analysis', 'medium', {
    event: 'ETH 突破 4000',
    symbol: 'ETH',
    probability: 0.65,
    probabilityDelta: 0.1,
    description: 'ETH 突破概率上升至 65%',
  });
  feedBus.publish(polyFeed2);
  console.log('🎯 Polymarket:', polyFeed2.data.description);
  console.log('   ✅ 信号共振：Technical + Macro + Poly 三方确认\n');

  await delay(500);
  const decision2 = await pa.processFeed(techFeed2);

  console.log('PA 决策:', decision2.decision);
  console.log('信心分数:', decision2.confidence_score);
  console.log('建议仓位:', (decision2.tool_call.args?.target_percent * 100)?.toFixed(0) + '%');
  console.log('给用户:', decision2.human_message);
  console.log();

  // ═══════════════════════════════════════════════════
  // 场景 3：风控否决
  // ═══════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════');
  console.log('  场景 3：风控否决（Risk Veto）');
  console.log('═══════════════════════════════════════════════════\n');

  const riskFeed = createFeed('risk', 'risk', 'critical', {
    level: 'veto',
    metric: 'account_drawdown',
    value: 0.15,
    threshold: 0.1,
    action: 'pause',
    description: '账户回撤超过 10%，触发风控熔断',
  });
  feedBus.publish(riskFeed);
  console.log('🚨 Risk Agent:', riskFeed.data.description);

  await delay(200);
  const decision3 = await pa.processFeed(riskFeed);

  console.log('PA 决策:', decision3.decision);
  console.log('风控否决:', decision3.thought_process.risk_veto);
  console.log('给用户:', decision3.human_message);
  console.log();

  // ═══════════════════════════════════════════════════
  // 用户对话演示
  // ═══════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════');
  console.log('  用户对话演示');
  console.log('═══════════════════════════════════════════════════\n');

  const conversations = [
    '分析 BTC',
    '我的资产',
    '买入 ETH',
  ];

  for (const msg of conversations) {
    console.log(`用户: "${msg}"`);
    const response = await pa.chat(msg);
    console.log(`PA: ${response.content.slice(0, 200)}...\n`);
    await delay(300);
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('  演示完成');
  console.log('═══════════════════════════════════════════════════');
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 如果直接运行
if (require.main === module) {
  runCEOExample().catch(console.error);
}
