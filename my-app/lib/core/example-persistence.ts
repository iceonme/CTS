/**
 * TradeMind Framework - Feed 持久化 + 集体记忆示例
 * 
 * 演示：
 * 1. Feed 自动保存到文件（每个 Agent 一个 JSON 文件）
 * 2. 重要 Feed 自动汇总到集体记忆
 * 3. PA 决策时参考集体记忆
 */

import { PA, getPA } from '@/lib/agents/pa';
import { BaseAgent } from './base-agent';
import { feedBus, createFeed } from './feed';
import {
  enableFeedPersistence,
  getAgentFeedStorage,
  getCollectiveMemoryStorage,
} from './feed-storage';
import type { SkillDefinition } from './types';

// 注册基础 Skills
BaseAgent.registerSkill({
  id: 'feed:get',
  name: '获取情报',
  description: '获取最新市场情报 Feed',
  parameters: [{ name: 'limit', type: 'number', required: false, description: '数量限制' }],
  handler: async (params) => feedBus.query({ limit: params.limit || 10 }),
});

BaseAgent.registerSkill({
  id: 'portfolio:get',
  name: '查看持仓',
  description: '获取当前投资组合',
  parameters: [],
  handler: async () => ({
    totalEquity: 10000,
    balance: 5000,
    positions: [{ symbol: 'BTC', quantity: 0.05, avgPrice: 68000, unrealizedPnl: 200 }],
  }),
});

BaseAgent.registerSkill({
  id: 'set_target_position',
  name: '设置目标仓位',
  description: '设置目标仓位比例',
  parameters: [
    { name: 'symbol', type: 'string', required: true, description: '币种' },
    { name: 'target_percent', type: 'number', required: true, description: '目标仓位 0-1' },
  ],
  handler: async (params) => {
    console.log(`[Execution] ${params.symbol} -> ${(params.target_percent * 100).toFixed(0)}%`);
    return { success: true };
  },
});

BaseAgent.registerSkill({
  id: 'add_to_watchlist',
  name: '加入观察列表',
  description: '加入重点监控',
  parameters: [
    { name: 'symbol', type: 'string', required: true },
    { name: 'reason', type: 'string', required: false },
  ],
  handler: async (params) => ({ success: true }),
});

export async function runPersistenceExample() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  TradeMind Feed 持久化 + 集体记忆示例');
  console.log('═══════════════════════════════════════════════════\n');

  // 启用持久化
  enableFeedPersistence();
  console.log('✅ Feed 持久化已启用\n');

  // 初始化 PA
  const pa = getPA();
  pa.setAutoExecute(false); // 演示模式，不自动执行

  // ═══════════════════════════════════════════════════
  // 场景 1: Technical Agent 发布信号
  // ═══════════════════════════════════════════════════
  console.log('【场景 1】Technical Agent 发布突破信号\n');

  const techFeed1 = createFeed('technical', 'signal', 'high', {
    symbol: 'BTC',
    signalType: 'breakout',
    strength: 0.85,
    indicators: { rsi: 72, trend: 'up' },
    price: { current: 68500 },
    timeframe: '1h',
    description: 'BTC 突破 68k 关键阻力位',
  });
  feedBus.publish(techFeed1);
  console.log('📊 Technical 发布:', techFeed1.data.description);
  console.log('   → 已保存到 data/feeds/technical.json\n');

  await delay(100);

  // ═══════════════════════════════════════════════════
  // 场景 2: Polymarket Agent 发布（诱多信号）
  // ═══════════════════════════════════════════════════
  console.log('【场景 2】Polymarket Agent 发布概率变化（诱多）\n');

  const polyFeed1 = createFeed('poly', 'analysis', 'high', {
    event: 'BTC 本月突破 70k',
    symbol: 'BTC',
    probability: 0.35,
    probabilityDelta: -0.15,
    volume: 500000,
    liquidity: 2000000,
    description: '突破概率从 50% 降至 35%',
  });
  feedBus.publish(polyFeed1);
  console.log('🎯 Polymarket 发布:', polyFeed1.data.description);
  console.log('   ⚠️ 价格 vs 概率背离 → 诱多嫌疑');
  console.log('   → 已保存到 data/feeds/poly.json\n');

  await delay(100);

  // 查看文件存储状态
  console.log('【文件存储状态】\n');
  const techStorage = getAgentFeedStorage('technical');
  const polyStorage = getAgentFeedStorage('poly');
  console.log(`Technical: ${techStorage.getStats().total} 条 Feed`);
  console.log(`Polymarket: ${polyStorage.getStats().total} 条 Feed\n`);

  // ═══════════════════════════════════════════════════
  // 场景 3: PA 决策（生成集体记忆）
  // ═══════════════════════════════════════════════════
  console.log('【场景 3】PA 分析并生成集体记忆\n');

  const decision = await pa.processFeed(polyFeed1);
  
  console.log('PA 决策:', decision.decision);
  console.log('信心分数:', decision.confidence_score);
  console.log('综合判断:', decision.thought_process.synthesis);
  console.log();

  // 查看集体记忆
  const collective = getCollectiveMemoryStorage();
  const memories = collective.query({ symbol: 'BTC', limit: 5 });
  
  console.log(`【集体记忆】已生成 ${memories.length} 条记忆:\n`);
  memories.forEach((mem, i) => {
    console.log(`  ${i + 1}. [${mem.type}] ${mem.content.slice(0, 60)}...`);
    console.log(`     置信度: ${(mem.confidence * 100).toFixed(0)}% | 来源: ${mem.agentSources.join(', ')}`);
  });
  console.log();

  // ═══════════════════════════════════════════════════
  // 场景 4: 第二次同样情况（PA 参考集体记忆）
  // ═══════════════════════════════════════════════════
  console.log('【场景 4】再次出现类似信号（PA 参考历史）\n');

  const techFeed2 = createFeed('technical', 'signal', 'high', {
    symbol: 'BTC',
    signalType: 'breakout',
    strength: 0.8,
    indicators: { rsi: 70, trend: 'up' },
    price: { current: 69000 },
    timeframe: '1h',
    description: 'BTC 再次尝试突破',
  });
  
  const polyFeed2 = createFeed('poly', 'analysis', 'high', {
    event: 'BTC 突破 7万',
    symbol: 'BTC',
    probability: 0.33,
    probabilityDelta: -0.1,
    volume: 450000,
    liquidity: 1800000,
    description: '概率持续下降',
  });

  feedBus.publish(techFeed2);
  feedBus.publish(polyFeed2);

  console.log('Technical: BTC 再次突破');
  console.log('Polymarket: 概率继续下降（历史重演）\n');

  const decision2 = await pa.processFeed(polyFeed2);
  
  console.log('PA 决策:', decision2.decision);
  console.log('综合判断:', decision2.thought_process.synthesis);
  console.log('   ↑ 注意：PA 参考了集体记忆中的历史教训\n');

  // ═══════════════════════════════════════════════════
  // 场景 5: 查看集体记忆文件
  // ═══════════════════════════════════════════════════
  console.log('【场景 5】集体记忆文件导出\n');
  
  const allMemories = collective.query({ limit: 100 });
  console.log(`总计 ${allMemories.length} 条记忆\n`);

  // 导出知识图谱格式
  const kg = collective.exportForKnowledgeGraph();
  console.log(`知识图谱节点: ${kg.nodes.length}`);
  console.log(`知识图谱边: ${kg.edges.length}\n`);

  console.log('【文件位置】');
  console.log('- Agent Feeds: ./data/feeds/{agentId}.json');
  console.log('- 集体记忆: ./data/collective-memory.json\n');

  console.log('═══════════════════════════════════════════════════');
  console.log('  持久化演示完成');
  console.log('═══════════════════════════════════════════════════');
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 如果直接运行
if (require.main === module) {
  runPersistenceExample().catch(console.error);
}
