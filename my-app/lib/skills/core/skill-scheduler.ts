/**
 * Skill Scheduler
 * Skill 调度器 - 处理时间触发(Cron)和事件触发
 * 
 * 每个 Agent 的 Skill 可以通过以下方式触发:
 * 1. Cron 定时触发 - 如每5分钟执行一次
 * 2. 事件触发 - 如收到某个事件后立即执行
 * 3. 手动触发 - 用户交互或代码调用
 */

import type { Skill, SkillContext, SkillTrigger, AgentConfig, AgentSkillConfig, SkillEvent } from '../types';
import { skillRegistry } from './skill-registry';
import { toolRegistry } from './tool-registry';

interface ScheduledSkill {
  skillId: string;
  agentId: string;
  agentName: string;
  cronExpression: string;
  lastRun?: Date;
  nextRun?: Date;
  enabled: boolean;
}

class SkillScheduler {
  private schedules: Map<string, ScheduledSkill> = new Map();
  private cronJobs: Map<string, NodeJS.Timeout> = new Map();
  private eventBindings: Map<string, Set<{ agentId: string; skillId: string }>> = new Map();

  // ==================== Cron 调度 ====================

  /**
   * 为 Agent 的 Skill 添加 Cron 调度
   */
  scheduleSkill(
    agentConfig: AgentConfig,
    skillConfig: AgentSkillConfig,
    cronExpression: string
  ): void {
    const scheduleId = `${agentConfig.id}:${skillConfig.skillId}`;
    
    if (this.schedules.has(scheduleId)) {
      console.warn(`[SkillScheduler] Schedule ${scheduleId} already exists, removing old schedule`);
      this.unscheduleSkill(agentConfig.id, skillConfig.skillId);
    }

    this.schedules.set(scheduleId, {
      skillId: skillConfig.skillId,
      agentId: agentConfig.id,
      agentName: agentConfig.name,
      cronExpression,
      enabled: skillConfig.enabled,
    });

    // 解析 Cron 表达式并设置定时器 (简化版，使用 setInterval)
    const intervalMs = this.cronToMs(cronExpression);
    if (intervalMs > 0) {
      const timer = setInterval(async () => {
        await this.executeScheduledSkill(scheduleId);
      }, intervalMs);
      
      this.cronJobs.set(scheduleId, timer);
      console.log(`[SkillScheduler] Scheduled ${scheduleId} with interval ${intervalMs}ms`);

      // 立即执行一次
      this.executeScheduledSkill(scheduleId);
    }
  }

  /**
   * 移除 Cron 调度
   */
  unscheduleSkill(agentId: string, skillId: string): void {
    const scheduleId = `${agentId}:${skillId}`;
    
    // 清除定时器
    const timer = this.cronJobs.get(scheduleId);
    if (timer) {
      clearInterval(timer);
      this.cronJobs.delete(scheduleId);
    }

    this.schedules.delete(scheduleId);
    console.log(`[SkillScheduler] Unscheduled ${scheduleId}`);
  }

  /**
   * 执行定时任务
   */
  private async executeScheduledSkill(scheduleId: string): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || !schedule.enabled) return;

    const skill = skillRegistry.get(schedule.skillId);
    if (!skill) {
      console.error(`[SkillScheduler] Skill ${schedule.skillId} not found`);
      return;
    }

    console.log(`[SkillScheduler] Executing scheduled skill: ${scheduleId}`);

    const context: SkillContext = {
      agent: {
        id: schedule.agentId,
        name: schedule.agentName,
        role: 'analyst', // 需要根据 Agent 配置获取
      },
      input: {}, // 定时任务可能没有特定输入
      tools: new Map(),
    };

    const result = await skillRegistry.execute(schedule.skillId, context);
    
    schedule.lastRun = new Date();
    this.schedules.set(scheduleId, schedule);

    // 触发完成事件
    skillRegistry.emitEvent({
      type: 'scheduler:skill:completed',
      source: scheduleId,
      payload: { scheduleId, skillId: schedule.skillId, result },
      timestamp: new Date(),
    });
  }

  // ==================== 事件绑定 ====================

  /**
   * 绑定 Skill 到事件
   * 当指定事件触发时，自动执行该 Skill
   */
  bindSkillToEvent(
    agentConfig: AgentConfig,
    skillConfig: AgentSkillConfig,
    eventType: string
  ): void {
    if (!this.eventBindings.has(eventType)) {
      this.eventBindings.set(eventType, new Set());
    }

    this.eventBindings.get(eventType)!.add({
      agentId: agentConfig.id,
      skillId: skillConfig.skillId,
    });

    // 订阅事件
    skillRegistry.onEvent(eventType, async (event: SkillEvent) => {
      await this.handleEventTriggeredSkill(agentConfig, skillConfig, event);
    });

    console.log(`[SkillScheduler] Bound ${agentConfig.id}:${skillConfig.skillId} to event ${eventType}`);
  }

  /**
   * 处理事件触发的 Skill 执行
   */
  private async handleEventTriggeredSkill(
    agentConfig: AgentConfig,
    skillConfig: AgentSkillConfig,
    event: SkillEvent
  ): Promise<void> {
    if (!skillConfig.enabled) return;

    const skill = skillRegistry.get(skillConfig.skillId);
    if (!skill) return;

    console.log(`[SkillScheduler] Event ${event.type} triggered skill ${skillConfig.skillId}`);

    const context: SkillContext = {
      agent: {
        id: agentConfig.id,
        name: agentConfig.name,
        role: agentConfig.role,
      },
      input: { event }, // 将事件数据作为输入
      tools: new Map(),
    };

    await skillRegistry.execute(skillConfig.skillId, context);
  }

  // ==================== 工具方法 ====================

  /**
   * Cron 表达式转毫秒 (简化版)
   * 支持: 每5分钟, 每小时等
   */
  private cronToMs(cron: string): number {
    const parts = cron.split(' ');
    if (parts.length !== 5) {
      console.warn(`[SkillScheduler] Invalid cron expression: ${cron}, using default 5 minutes`);
      return 5 * 60 * 1000;
    }

    const [minute, hour] = parts;

    // */5 - 每5分钟
    if (minute.startsWith('*/')) {
      const interval = parseInt(minute.slice(2));
      return interval * 60 * 1000;
    }

    // 0 - 每小时
    if (minute === '0' && hour.startsWith('*/')) {
      const interval = parseInt(hour.slice(2));
      return interval * 60 * 60 * 1000;
    }

    // 默认5分钟
    return 5 * 60 * 1000;
  }

  /**
   * 获取所有调度任务
   */
  getSchedules(): ScheduledSkill[] {
    return Array.from(this.schedules.values());
  }

  /**
   * 停止所有调度
   */
  stopAll(): void {
    this.cronJobs.forEach(timer => clearInterval(timer));
    this.cronJobs.clear();
    console.log('[SkillScheduler] All schedules stopped');
  }
}

// 单例导出
export const skillScheduler = new SkillScheduler();
export default skillScheduler;
