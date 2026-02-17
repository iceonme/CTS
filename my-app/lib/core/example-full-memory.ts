/**
 * TradeMind Framework - 完整三层记忆示例
 * 
 * 演示每个 Agent 的完整记忆体系：
 * 1. Session Memory（内存）- 当前对话上下文
 * 2. Individual Memory（文件）- 成长档案
 *    - feed.json: 记事本（说过的话）
 *    - stats.json: 统计数据
 *    - experiences.json: 经历记录
 *    - insights.json: 学到的规律
 *    - preferences.json: 用户偏好
 * 3. Collective Memory（文件）- 群体智慧
 * 
 * 文件结构：
 * data/
 * ├── agents/
 * │   └── {agentId}/
 * │       ├── feed.json          # Agent 发布的 Feed（记事本）
 * │       ├── stats.json         # 统计数据
 * │       ├── experiences.json   # 经历记录
 * │       ├── insights.json      # 学到的洞察
 * │       └── preferences.json   # 用户偏好
 * └── collective-memory.json     # 群体记忆
 */

import { PA, getPA } from '@/lib/agents/pa';
import { BaseAgent } from './base-agent';
import { feedBus, createFeed } from './feed';
import {
  enableFeedPersistence,
  getAgentFeedStorage,
  getCollectiveMemoryStorage,
} from './feed-storage';
import { getIndividualMemoryStorage } from './individual-memory';
import type { SkillDefinition } from './types';

// 注册基础 Skills
const skills: SkillDefinition[] = [
  {
    id: 'feed:get',
    name: '获取情报',
    description: '获取最新市场情报 Feed',
    parameters: [{ name: 'limit', type: 'number', required: false, description: '数量限制' }],
    handler: async (params) => feedBus.query({ limit: params.limit || 10 }),
  },
  {
    id: 'portfolio:get',
    name: '查看持仓',
    description: '获取当前投资组合',
    parameters: [],
    handler: async () => ({
      totalEquity: 10000,
      balance: 5000,
      positions: [{ symbol: 'BTC', quantity: 0.05, avgPrice: 68000, unrealizedPnl: 200 }],
    }),
  },
  {
    id: 'set_target_position',
    name: '设置目标仓位',
    description: '设置目标仓位比例',
    parameters: [
      { name: 'symbol', type: 'string', required: true, description: '币种' },
      { name: 'target_percent', type: 'number', required: true, description: '目标仓位 0-1' },
    ],
    handler: async (params) => {
      console.log(`[执行] ${params.symbol} -> ${(params.target_percent * 100).toFixed(0)}%`);
      return { success: true };
    },
  },
  {
    id: 'add_to_watchlist',
    name: '加入观察列表',
    description: '加入重点监控',
    parameters: [
      { name: 'symbol', type: 'string', required: true },
      { name: 'reason', type: 'string', required: false },
    ],
    handler: async (params) => ({ success: true }),
  },
];

skills.forEach(s => BaseAgent.registerSkill(s));

export async function runFullMemoryExample() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('     TradeMind 完整三层记忆体系演示');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 启用持久化
  enableFeedPersistence();
  console.log('✅ Feed 持久化已启用\n');

  // ═══════════════════════════════════════════════════════════════
  // 场景 1: Technical Agent 发布信号（生成三层记忆）
  // ═══════════════════════════════════════════════════════════════
  console.log('【场景 1】Technical Agent 发布突破信号\n');

  const techFeed = createFeed('technical', 'signal', 'high', {
    symbol: 'BTC',
    signalType: 'breakout',
    strength: 0.85,
    indicators: { rsi: 72, trend: 'up' },
    price: { current: 68500 },
    timeframe: '1h',
    description: 'BTC 突破 68k 关键阻力位，成交量放大',
  });
  
  feedBus.publish(techFeed);
  
  // 记录到 Technical Agent 的个体记忆
  const techMemory = getIndividualMemoryStorage('technical');
  techMemory.addExperience({
    type: 'feed_published',
    content: `发布 BTC 突破信号，强度 85%`,
    result: 'neutral',
    metadata: { feedId: techFeed.id, symbol: 'BTC', signalType: 'breakout' },
  });
  techMemory.updateStats({ totalAnalyses: 1 });

  console.log('📊 Technical 发布信号:', techFeed.data.description);
  console.log('   → Feed 保存到: data/agents/technical/feed.json');
  console.log('   → 经历保存到: data/agents/technical/experiences.json');
  console.log('   → 统计保存到: data/agents/technical/stats.json\n');

  await delay(200);

  // ═══════════════════════════════════════════════════════════════
  // 场景 2: Polymarket Agent 发布（诱多信号）
  // ═══════════════════════════════════════════════════════════════
  console.log('【场景 2】Polymarket Agent 发布概率变化\n');

  const polyFeed = createFeed('poly', 'analysis', 'high', {
    event: 'BTC 本月突破 70k',
    symbol: 'BTC',
    probability: 0.35,
    probabilityDelta: -0.15,
    volume: 500000,
    liquidity: 2000000,
    description: '尽管价格上涨，但突破概率从 50% 降至 35%',
  });
  
  feedBus.publish(polyFeed);
  
  // 记录到 Poly Agent 的个体记忆
  const polyMemory = getIndividualMemoryStorage('poly');
  polyMemory.addExperience({
    type: 'feed_published',
    content: `发布 BTC 概率分析：${polyFeed.data.description}`,
    result: 'neutral',
    metadata: { feedId: polyFeed.id, probabilityDelta: -0.15 },
  });
  polyMemory.updateStats({ totalAnalyses: 1 });

  console.log('🎯 Polymarket 发布:', polyFeed.data.description);
  console.log('   ⚠️ 价格 vs 概率背离（诱多信号）');
  console.log('   → Feed 保存到: data/agents/poly/feed.json\n');

  await delay(200);

  // ═══════════════════════════════════════════════════════════════
  // 场景 3: PA 决策（使用三层记忆）
  // ═══════════════════════════════════════════════════════════════
  console.log('【场景 3】PA 决策（使用三层记忆）\n');

  const pa = getPA();
  pa.setAutoExecute(false);

  // PA 的 Session Memory（当前对话）
  pa.memory.session.addMessage('user', '分析 BTC 现在的情况');
  
  // PA 的 Individual Memory（PA 自己的成长）
  const paMemory = getIndividualMemoryStorage('pa');
  paMemory.addExperience({
    type: 'analysis',
    content: '用户请求分析 BTC',
    result: 'pending',
  });

  const decision = await pa.processFeed(polyFeed);
  
  console.log('PA 决策过程：');
  console.log('  1. Session Memory（内存）:', '当前对话上下文');
  console.log('  2. Individual Memory（文件）:', 'PA 自己的决策历史');
  console.log('  3. Collective Memory（文件）:', '团队共享的智慧');
  console.log();
  console.log('决策结果:', decision.decision);
  console.log('信心分数:', decision.confidence_score);
  console.log('综合判断:', decision.thought_process.synthesis);
  console.log();

  await delay(200);

  // ═══════════════════════════════════════════════════════════════
  // 场景 4: Technical Agent 学习模式
  // ═══════════════════════════════════════════════════════════════
  console.log('【场景 4】Technical Agent 学习并生成洞察\n');

  // Technical Agent 从经历中学习
  techMemory.addInsight({
    pattern: 'RSI 超买 + 成交量放大',
    description: '当 RSI > 70 且成交量是平均 2 倍以上时，后续 24h 回调概率 65%',
    confidence: 0.65,
    tags: ['BTC', 'RSI', 'volume', 'reversal'],
  });

  techMemory.addInsight({
    pattern: '突破关键阻力位',
    description: '价格突破前高且站稳 4h，趋势确认成功率高',
    confidence: 0.78,
    tags: ['breakout', 'trend', 'support_resistance'],
  });

  // 记录更多经历
  for (let i = 0; i < 5; i++) {
    techMemory.addExperience({
      type: 'analysis',
      content: `分析 BTC 第 ${i + 1} 次`,
      result: i % 2 === 0 ? 'success' : 'failure',
      metadata: { symbol: 'BTC', iteration: i },
    });
  }

  // 更新预测准确率统计
  techMemory.updateStats({
    correctPredictions: 3,
    wrongPredictions: 2,
  });

  console.log('Technical Agent 学习成果：');
  console.log('  统计:', JSON.stringify(techMemory.stats, null, 2));
  console.log('  洞察数:', techMemory.getInsights().length);
  console.log('  经历数:', techMemory.getExperiences().length);
  console.log();

  // 查看生成的个人档案
  console.log('Technical Agent 个人档案：');
  console.log(techMemory.generateProfileSummary());
  console.log();

  await delay(200);

  // ═══════════════════════════════════════════════════════════════
  // 场景 5: 查看文件存储状态
  // ═══════════════════════════════════════════════════════════════
  console.log('【场景 5】文件存储状态\n');

  console.log('文件结构：');
  console.log('data/');
  console.log('├── agents/');
  console.log('│   ├── technical/');
  console.log('│   │   ├── feed.json          # 记事本（' + techMemory.getExperiences({ type: 'feed_published' }).length + ' 条）');
  console.log('│   │   ├── stats.json         # 统计数据');
  console.log('│   │   ├── experiences.json   # 经历记录（' + techMemory.getExperiences().length + ' 条）');
  console.log('│   │   ├── insights.json      # 洞察（' + techMemory.getInsights().length + ' 条）');
  console.log('│   │   └── preferences.json   # 用户偏好');
  console.log('│   ├── poly/');
  console.log('│   │   ├── feed.json');
  console.log('│   │   └── ...');
  console.log('│   └── pa/');
  console.log('│       └── ...');
  console.log('└── collective-memory.json     # 群体记忆');
  console.log();

  // 查看集体记忆
  const collective = getCollectiveMemoryStorage();
  const memories = collective.query({ limit: 10 });
  console.log(`集体记忆: ${memories.length} 条`);
  memories.forEach((mem, i) => {
    console.log(`  ${i + 1}. [${mem.type}] ${mem.content.slice(0, 50)}...`);
  });
  console.log();

  // ═══════════════════════════════════════════════════════════════
  // 场景 6: 重启后恢复（模拟）
  // ═══════════════════════════════════════════════════════════════
  console.log('【场景 6】重启后恢复记忆（模拟）\n');

  // 创建新的 storage 实例（模拟重启）
  const newTechMemory = getIndividualMemoryStorage('technical');
  console.log('模拟重启后 Technical Agent 恢复：');
  console.log('  经历数:', newTechMemory.getExperiences().length);
  console.log('  洞察数:', newTechMemory.getInsights().length);
  console.log('  准确率:', (newTechMemory.stats.accuracyRate * 100).toFixed(1) + '%');
  console.log('  ✅ 记忆已从文件恢复！');
  console.log();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('     完整三层记忆体系演示完成');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();
  console.log('总结：');
  console.log('• Session Memory（内存）: 临时对话上下文，重启清空');
  console.log('• Individual Memory（文件）: Agent 成长档案，永久保存');
  console.log('• Collective Memory（文件）: 群体智慧，跨 Agent 共享');
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 如果直接运行
if (require.main === module) {
  runFullMemoryExample().catch(console.error);
}
