/**
 * Skill Registry
 * Anthropic Skills 注册中心
 * 
 * Skill 是封装的领域专业知识，包含 instructions + tools + templates
 */

import type { Skill, SkillContext, SkillResult, SkillEvent, SkillEventHandler } from '../types';
import { toolRegistry } from './tool-registry';

class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private eventHandlers: Map<string, Set<SkillEventHandler>> = new Map();

  /**
   * 注册 Skill
   */
  register(skill: Skill): void {
    if (this.skills.has(skill.id)) {
      console.warn(`[SkillRegistry] Skill ${skill.id} already exists, overwriting`);
    }
    this.skills.set(skill.id, skill);
    console.log(`[SkillRegistry] Registered skill: ${skill.id} (${skill.name})`);
  }

  /**
   * 获取 Skill
   */
  get(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }

  /**
   * 获取所有 Skills
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * 按分类获取 Skills
   */
  getByCategory(category: Skill['category']): Skill[] {
    return this.getAll().filter(s => s.category === category);
  }

  /**
   * 执行 Skill
   */
  async execute(skillId: string, context: SkillContext): Promise<SkillResult> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return {
        success: false,
        error: `Skill not found: ${skillId}`,
      };
    }

    // 检查工具依赖
    for (const toolId of skill.tools.required) {
      if (!toolRegistry.has(toolId)) {
        return {
          success: false,
          error: `Required tool not available: ${toolId}`,
        };
      }
    }

    // 将工具注入上下文
    const mergedTools = new Map(context.tools);
    // 注入 Skill 所需的工具
    skill.tools.required.forEach(id => {
      const tool = toolRegistry.get(id);
      if (tool) mergedTools.set(id, tool);
    });
    // 注入可选工具
    (skill.tools.optional || []).forEach(id => {
      const tool = toolRegistry.get(id);
      if (tool) mergedTools.set(id, tool);
    });
    
    const enrichedContext: SkillContext = {
      ...context,
      tools: mergedTools,
    };

    const startTime = Date.now();
    try {
      const result = await skill.execute(enrichedContext);
      
      // 添加元数据
      result.metadata = {
        ...result.metadata,
        executionTime: Date.now() - startTime,
        toolsUsed: skill.tools.required,
      };

      console.log(`[SkillRegistry] Executed ${skillId} in ${result.metadata.executionTime}ms`);
      
      // 触发事件
      if (result.success) {
        this.emitEvent({
          type: 'skill:completed',
          source: skillId,
          payload: { skillId, result },
          timestamp: new Date(),
        });
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[SkillRegistry] Skill ${skillId} failed:`, errorMsg);
      
      this.emitEvent({
        type: 'skill:failed',
        source: skillId,
        payload: { skillId, error: errorMsg },
        timestamp: new Date(),
        priority: 'high',
      });

      return {
        success: false,
        error: errorMsg,
        metadata: { executionTime: Date.now() - startTime },
      };
    }
  }

  // ==================== 事件系统 ====================

  /**
   * 订阅事件
   */
  onEvent(eventType: string, handler: SkillEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);

    // 返回取消订阅函数
    return () => {
      this.eventHandlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * 触发事件
   */
  emitEvent(event: SkillEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`[SkillRegistry] Event handler failed for ${event.type}:`, error);
        }
      });
    }

    // 同时触发通配符事件
    const wildcardHandlers = this.eventHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`[SkillRegistry] Wildcard handler failed:`, error);
        }
      });
    }
  }

  /**
   * 获取所有事件类型
   */
  getEventTypes(): string[] {
    return Array.from(this.eventHandlers.keys());
  }
}

// 单例导出
export const skillRegistry = new SkillRegistry();
export default skillRegistry;
