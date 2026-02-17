/**
 * Skill 配置系统入口
 * 
 * 支持通过外部界面动态配置用户的 Personal Assistant (PA)
 */

// 类型定义
export * from './types';

// 配置管理器
export { getPAConfigManager, PAConfigManager } from './manager';

// ==================== 配置化 PA Skill 工厂 ====================

import type { Skill, SkillContext, SkillResult } from '../types';
import type { SkillConfig } from './types';
import { skillRegistry } from '../core/skill-registry';
import { getPAConfigManager } from './manager';

/**
 * 从配置创建 Skill
 * 
 * 将 SkillConfig 转换为可执行的 Skill 实例
 */
export function createSkillFromConfig(config: SkillConfig): Skill {
  return {
    id: config.id,
    name: config.metadata.name,
    description: config.metadata.description,
    category: config.metadata.category === 'decision' ? 'strategist' : 'analyst',
    version: config.metadata.version,

    instructions: config.instructions,

    tools: config.tools,

    inputSchema: {
      type: 'object',
      properties: {},
    },

    outputSchema: {
      type: 'object',
      properties: {},
    },

    triggers: convertTriggers(config.triggers),

    // 执行函数 - 从配置动态生成
    execute: async (context: SkillContext): Promise<SkillResult> => {
      // 这里可以实现从配置动态执行的逻辑
      // 例如: 根据配置的 instructions 调用 LLM，或执行配置的工作流
      
      console.log(`[ConfigSkill] Executing ${config.id} with config:`, {
        lookback: config.parameters.lookbackMinutes,
        threshold: config.parameters.confidenceThreshold,
      });

      // 实际执行逻辑由具体 Skill 实现
      // 这里只是一个示例框架
      return {
        success: true,
        data: {
          message: `Skill ${config.id} executed with custom config`,
          config: config.parameters,
        },
      };
    },
  };
}

/**
 * 将 SkillConfig 的 triggers 转换为 SkillTrigger[]
 */
function convertTriggers(triggers: SkillConfig['triggers']): Skill['triggers'] {
  const result: Skill['triggers'] = [];
  
  if (triggers.cron) {
    result.push({
      type: 'cron',
      schedule: triggers.cron,
    });
  }
  
  if (triggers.events) {
    triggers.events.forEach(event => {
      result.push({
        type: 'event',
        event,
      });
    });
  }
  
  return result.length > 0 ? result : undefined;
}

/**
 * 初始化可配置 PA 系统
 * 
 * 从配置管理器加载配置，注册所有启用的 Skills
 */
export function initializeConfigurablePA(): void {
  console.log('[ConfigurablePA] Initializing...');

  const configManager = getPAConfigManager();
  const config = configManager.getConfig();

  // 1. 注册所有启用的 Skills
  for (const skillConfig of config.skills) {
    if (skillConfig.enabled) {
      const skill = createSkillFromConfig(skillConfig);
      skillRegistry.register(skill);
      console.log(`[ConfigurablePA] Registered skill: ${skill.id}`);
    }
  }

  // 2. 订阅配置变更，实现热更新
  configManager.subscribe((event) => {
    console.log('[ConfigurablePA] Config changed:', event);
    
    if (event.type === 'skill:updated') {
      // 重新注册更新的 Skill
      const skillConfig = configManager.getSkillConfig(event.skillId!);
      if (skillConfig && skillConfig.enabled) {
        const skill = createSkillFromConfig(skillConfig);
        skillRegistry.register(skill);
        console.log(`[ConfigurablePA] Hot-reloaded skill: ${skill.id}`);
      }
    }
    
    if (event.type === 'skill:enabled') {
      const skillConfig = configManager.getSkillConfig(event.skillId!);
      if (skillConfig) {
        const skill = createSkillFromConfig(skillConfig);
        skillRegistry.register(skill);
      }
    }
  });

  console.log('[ConfigurablePA] Initialization complete');
}

/**
 * 获取 PA 当前配置摘要
 */
export function getPAConfigSummary(): {
  name: string;
  enabledSkills: string[];
  workMode: string;
} {
  const config = getPAConfigManager().getConfig();
  return {
    name: config.identity.name,
    enabledSkills: config.global.enabledSkills,
    workMode: config.global.workMode.riskLevel,
  };
}
