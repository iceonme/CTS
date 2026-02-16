/**
 * Skill 配置系统入口
 * 
 * 支持通过外部界面动态配置 CFO Skills
 */

// 类型定义
export * from './types';

// 配置管理器
export { getConfigManager, ConfigManager } from './manager';

// ==================== 配置化 CFO Skill 工厂 ====================

import type { Skill, SkillContext, SkillResult } from '../types';
import type { SkillConfig } from './types';
import { skillRegistry } from '../core/skill-registry';
import { getConfigManager } from './manager';

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

    triggers: config.triggers,

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
 * 初始化可配置 CFO 系统
 * 
 * 从配置管理器加载配置，注册所有启用的 Skills
 */
export function initializeConfigurableCFO(): void {
  console.log('[ConfigurableCFO] Initializing...');

  const configManager = getConfigManager();
  const config = configManager.getConfig();

  // 1. 注册所有启用的 Skills
  for (const skillConfig of config.skills) {
    if (skillConfig.enabled) {
      const skill = createSkillFromConfig(skillConfig);
      skillRegistry.register(skill);
      console.log(`[ConfigurableCFO] Registered skill: ${skill.id}`);
    }
  }

  // 2. 订阅配置变更，实现热更新
  configManager.subscribe((event) => {
    console.log('[ConfigurableCFO] Config changed:', event);
    
    if (event.type === 'skill:updated') {
      // 重新注册更新的 Skill
      const skillConfig = configManager.getSkillConfig(event.skillId!);
      if (skillConfig && skillConfig.enabled) {
        const skill = createSkillFromConfig(skillConfig);
        skillRegistry.register(skill);
        console.log(`[ConfigurableCFO] Hot-reloaded skill: ${skill.id}`);
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

  console.log('[ConfigurableCFO] Initialization complete');
}

/**
 * 获取 CFO 当前配置摘要
 */
export function getCFOConfigSummary(): {
  name: string;
  enabledSkills: string[];
  workMode: string;
} {
  const config = getConfigManager().getConfig();
  return {
    name: config.global.base.name,
    enabledSkills: config.global.enabledSkills,
    workMode: config.global.workMode.autoExecute ? '自动执行' : '手动确认',
  };
}
