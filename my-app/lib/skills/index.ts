/**
 * Skills 系统入口
 * 
 * 符合 Anthropic 标准的 Skills 架构:
 * - Tools: MCP 风格的工具注册
 * - Skills: 封装的领域知识
 * - Scheduler: 时间/事件驱动的调度器
 * - Config: 外部可配置的配置系统
 */

// ==================== 核心导出 ====================

// 类型定义
export * from './types';

// 核心组件
export { toolRegistry } from './core/tool-registry';
export { skillRegistry } from './core/skill-registry';
export { skillScheduler } from './core/skill-scheduler';

// Tools
export { CoinGeckoTools, CoinGeckoPriceTool, CoinGeckoChartTool, CoinGeckoBTCDOGETool } from './tools/coingecko-tools';

// Skills
export { 
  createFeedPublishSkill,
  TechAnalystFeedConfig,
  PolymarketFeedConfig,
  CFOFeedConfig,
  TechAnalystFeedSkill,
  PolymarketFeedSkill,
  CFOFeedSkill,
  subscribeToFeed,
  getFeedItems,
  clearFeed,
} from './agents/feed-publish-skill';

export { TechnicalAnalysisSkill } from './agents/tech-analysis-skill';

// 配置系统 (新增)
export {
  getConfigManager,
  ConfigManager,
  createSkillFromConfig,
  initializeConfigurableCFO,
  getCFOConfigSummary,
} from './config';

export type {
  SkillConfig,
  CFOGlobalConfig,
  CFOConfigBundle,
  ConfigVersion,
  ConfigChangeEvent,
} from './config';

// ==================== 系统初始化 ====================

import { toolRegistry } from './core/tool-registry';
import { skillRegistry } from './core/skill-registry';
import { skillScheduler } from './core/skill-scheduler';

import { CoinGeckoTools } from './tools/coingecko-tools';
import { TechAnalystFeedSkill, PolymarketFeedSkill, CFOFeedSkill } from './agents/feed-publish-skill';
import { TechnicalAnalysisSkill } from './agents/tech-analysis-skill';

import { getConfigManager, initializeConfigurableCFO } from './config';

/**
 * 初始化 Skills 系统
 * 
 * @param useConfig 是否使用可配置模式 (默认 true)
 */
export function initializeSkillsSystem(useConfig: boolean = true): void {
  console.log('[SkillsSystem] Initializing...');

  // 1. 注册 Tools
  console.log('[SkillsSystem] Registering Tools...');
  CoinGeckoTools.forEach(tool => toolRegistry.register(tool));

  if (useConfig) {
    // 2. 使用可配置模式 - 从配置管理器加载
    console.log('[SkillsSystem] Using configurable mode...');
    initializeConfigurableCFO();
  } else {
    // 3. 使用硬编码模式 - 注册预设 Skills
    console.log('[SkillsSystem] Registering preset Skills...');
    skillRegistry.register(TechAnalystFeedSkill);
    skillRegistry.register(PolymarketFeedSkill);
    skillRegistry.register(CFOFeedSkill);
    skillRegistry.register(TechnicalAnalysisSkill);

    // 设置事件监听
    skillRegistry.onEvent('skill:completed', async (event) => {
      if (event.payload?.skillId === 'technical:analyze') {
        const result = event.payload?.result;
        if (result?.success && result.data?.analyses) {
          for (const analysis of result.data.analyses) {
            await skillRegistry.execute('feed:publish:technical', {
              agent: { id: 'tech-analyst', name: '技术分析员', role: 'analyst' },
              input: {
                title: `${analysis.symbol} 技术分析: ${analysis.signal}`,
                content: analysis.reasoning,
                symbol: analysis.symbol,
                importance: analysis.confidence > 0.7 ? 'high' : 'medium',
                data: analysis,
              },
              tools: new Map(),
            });
          }
        }
      }
    });
  }

  console.log('[SkillsSystem] Initialization complete');
  console.log(`  - Tools: ${toolRegistry.getAll().length}`);
  console.log(`  - Skills: ${skillRegistry.getAll().length}`);
}

/**
 * 启动 Agent 的定时任务
 */
export function startAgentSchedules(): void {
  console.log('[SkillsSystem] Starting agent schedules...');

  // 从配置中获取调度信息
  const configManager = getConfigManager();
  const config = configManager.getConfig();

  for (const skillConfig of config.skills) {
    if (!skillConfig.enabled || !skillConfig.triggers?.cron) continue;

    // 为每个启用的 Skill 创建调度
    skillScheduler.scheduleSkill(
      {
        id: 'system-agent',
        name: 'System Agent',
        role: 'analyst',
        avatar: '🤖',
        skills: [{ skillId: skillConfig.id, enabled: true }],
      },
      { skillId: skillConfig.id, enabled: true },
      skillConfig.triggers.cron
    );
  }

  console.log('[SkillsSystem] Schedules started');
}

/**
 * 停止所有调度
 */
export function stopAllSchedules(): void {
  skillScheduler.stopAll();
  console.log('[SkillsSystem] All schedules stopped');
}
