/**
 * BaseAgent - 所有 Agent 的基类
 * 提供统一的接口和基础功能
 */

import { v4 as uuidv4 } from "uuid";
import type {
  AgentRole,
  AgentStatus,
  BaseAgentConfig,
  AgentMessage,
  AgentTask,
} from "@/lib/types";

// 简单的 UUID 生成（不需要额外依赖）
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export abstract class BaseAgent {
  public readonly id: string;
  public readonly name: string;
  public readonly role: AgentRole;
  protected status: AgentStatus = "idle";
  protected memory: AgentMessage[] = [];
  protected maxMemorySize: number = 50;
  protected systemPrompt: string;

  constructor(config: BaseAgentConfig) {
    this.id = generateId();
    this.name = config.name;
    this.role = config.role;
    this.systemPrompt = config.systemPrompt;
  }

  // ==================== 状态管理 ====================

  getStatus(): AgentStatus {
    return this.status;
  }

  protected setStatus(status: AgentStatus): void {
    this.status = status;
    this.onStatusChange(status);
  }

  protected onStatusChange(status: AgentStatus): void {
    // 子类可重写
    console.log(`[${this.name}] 状态变更为: ${status}`);
  }

  // ==================== 记忆管理 ====================

  /**
   * 添加消息到记忆
   */
  protected addToMemory(message: Omit<AgentMessage, "id" | "timestamp">): void {
    const fullMessage: AgentMessage = {
      ...message,
      id: generateId(),
      timestamp: new Date(),
    };

    this.memory.push(fullMessage);

    // 保持记忆大小限制
    if (this.memory.length > this.maxMemorySize) {
      this.memory = this.memory.slice(-this.maxMemorySize);
    }
  }

  /**
   * 获取最近的记忆
   */
  protected getRecentMemory(limit: number = 10): AgentMessage[] {
    return this.memory.slice(-limit);
  }

  /**
   * 清除记忆
   */
  clearMemory(): void {
    this.memory = [];
  }

  /**
   * 获取与特定主题相关的记忆
   */
  protected searchMemory(keyword: string): AgentMessage[] {
    return this.memory.filter(
      msg =>
        msg.content.toLowerCase().includes(keyword.toLowerCase()) ||
        JSON.stringify(msg.metadata).toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // ==================== 任务处理 ====================

  /**
   * 执行任务 - 子类必须实现
   */
  abstract executeTask<T>(task: AgentTask): Promise<T>;

  /**
   * 处理任务包装器
   */
  async processTask<T>(task: AgentTask): Promise<{
    success: boolean;
    data?: T;
    error?: string;
  }> {
    try {
      this.setStatus("analyzing");
      this.addToMemory({
        role: "system",
        content: `Started task: ${task.type}`,
        metadata: { taskId: task.id, taskType: task.type },
      });

      const startTime = Date.now();
      const result = await this.executeTask<T>(task);
      const duration = Date.now() - startTime;

      this.setStatus("completed");
      this.addToMemory({
        role: "system",
        content: `Completed task: ${task.type} in ${duration}ms`,
        metadata: { taskId: task.id, duration },
      });

      return { success: true, data: result };
    } catch (error) {
      this.setStatus("error");
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      this.addToMemory({
        role: "system",
        content: `任务失败: ${task.type} - ${errorMessage}`,
        metadata: { taskId: task.id, error: errorMessage },
      });

      return { success: false, error: errorMessage };
    }
  }

  // ==================== 对话接口 ====================

  /**
   * 与用户对话
   */
  async chat(userMessage: string, context?: Record<string, unknown>): Promise<string> {
    this.addToMemory({
      role: "user",
      content: userMessage,
      metadata: context,
    });

    const response = await this.generateResponse(userMessage, context);

    this.addToMemory({
      role: "agent",
      content: response,
      metadata: context,
    });

    return response;
  }

  /**
   * 生成回复 - 子类必须实现
   */
  protected abstract generateResponse(
    message: string,
    context?: Record<string, unknown>
  ): Promise<string>;

  // ==================== 工具方法 ====================

  /**
   * 格式化数字
   */
  protected formatNumber(num: number, decimals: number = 2): string {
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
    return num.toFixed(decimals);
  }

  /**
   * 格式化百分比
   */
  protected formatPercent(num: number): string {
    const sign = num >= 0 ? "+" : "";
    return `${sign}${num.toFixed(2)}%`;
  }

  /**
   * 延迟函数
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取 Agent 信息
   */
  getInfo(): {
    id: string;
    name: string;
    role: AgentRole;
    status: AgentStatus;
    memorySize: number;
  } {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      status: this.status,
      memorySize: this.memory.length,
    };
  }
}

export default BaseAgent;
