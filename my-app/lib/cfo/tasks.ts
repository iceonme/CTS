/**
 * 盯盘定时任务
 * 使用 node-cron 实现定期市场监控
 */

import cron from "node-cron";
import { getTechnicalAnalyst } from "@/lib/agents/tech-analyst";
import { analyzeMultipleWithCFO } from "@/lib/cfo/reasoning";
import type { WatchTask, TaskResult, IntelligenceItem, CFOAnalysis, TechnicalAnalysis } from "@/lib/types";

// ==================== 任务调度器 ====================

interface TaskCallback {
  onAnalysisComplete?: (analysis: CFOAnalysis) => void;
  onIntelligenceGenerated?: (item: IntelligenceItem) => void;
  onError?: (error: Error) => void;
}

class TaskScheduler {
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private callbacks: TaskCallback = {};
  private isRunning = false;

  constructor(callbacks: TaskCallback = {}) {
    this.callbacks = callbacks;
  }

  /**
   * 注册回调函数
   */
  setCallbacks(callbacks: TaskCallback): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 添加定时任务
   */
  addTask(task: WatchTask): void {
    if (this.tasks.has(task.id)) {
      console.warn(`[TaskScheduler] Task ${task.id} already exists, removing old task`);
      this.removeTask(task.id);
    }

    // 将分钟间隔转换为 cron 表达式
    const cronExpression = this.minutesToCron(task.interval);

    const scheduledTask = cron.schedule(cronExpression, async () => {
      await this.executeTask(task);
    }, {
      scheduled: task.enabled,
    });

    this.tasks.set(task.id, scheduledTask);
    console.log(`[TaskScheduler] Added task ${task.id}: ${task.symbol} every ${task.interval}min`);
  }

  /**
   * 移除定时任务
   */
  removeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      task.stop();
      this.tasks.delete(taskId);
      console.log(`[TaskScheduler] Removed task ${taskId}`);
      return true;
    }
    return false;
  }

  /**
   * 启动所有任务
   */
  startAll(): void {
    this.tasks.forEach((task, id) => {
      task.start();
      console.log(`[TaskScheduler] Started task ${id}`);
    });
    this.isRunning = true;
  }

  /**
   * 停止所有任务
   */
  stopAll(): void {
    this.tasks.forEach((task, id) => {
      task.stop();
      console.log(`[TaskScheduler] Stopped task ${id}`);
    });
    this.isRunning = false;
  }

  /**
   * 获取任务状态
   */
  getStatus(): {
    isRunning: boolean;
    taskCount: number;
    taskIds: string[];
  } {
    return {
      isRunning: this.isRunning,
      taskCount: this.tasks.size,
      taskIds: Array.from(this.tasks.keys()),
    };
  }

  /**
   * 执行任务
   */
  private async executeTask(task: WatchTask): Promise<void> {
    console.log(`[TaskScheduler] Executing task ${task.id} for ${task.symbol}`);

    const techAnalyst = getTechnicalAnalyst();

    try {
      // 1. 执行技术分析
      const technicalResult = await techAnalyst.processTask({
        id: `tech-${task.id}-${Date.now()}`,
        type: "analyze_symbol",
        data: { symbol: task.symbol },
        priority: "high",
        createdAt: new Date(),
      });

      if (!technicalResult.success || !technicalResult.data) {
        throw new Error(technicalResult.error || "Technical analysis failed");
      }

      // 2. CFO 推理分析
      const cfoAnalysis = analyzeMultipleWithCFO([technicalResult.data as TechnicalAnalysis])[0];

      // 3. 触发回调
      this.callbacks.onAnalysisComplete?.(cfoAnalysis);

      // 4. 生成情报项
      const intelligence = this.generateIntelligence(cfoAnalysis);
      this.callbacks.onIntelligenceGenerated?.(intelligence);

      // 5. 检查条件触发
      if (task.conditions) {
        await this.checkConditions(task, cfoAnalysis);
      }

      console.log(`[TaskScheduler] Task ${task.id} completed successfully`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[TaskScheduler] Task ${task.id} failed:`, err.message);
      this.callbacks.onError?.(err);
    }
  }

  /**
   * 检查条件触发
   */
  private async checkConditions(
    task: WatchTask,
    analysis: CFOAnalysis
  ): Promise<void> {
    if (!task.conditions) return;

    for (const condition of task.conditions) {
      let triggered = false;

      switch (condition.type) {
        case "price_above":
          // 需要从外部获取当前价格
          triggered = false; // 简化处理
          break;
        case "rsi_above":
          triggered = analysis.technicalData.indicators.rsi > condition.value;
          break;
        case "rsi_below":
          triggered = analysis.technicalData.indicators.rsi < condition.value;
          break;
        // 更多条件类型...
      }

      if (triggered && !condition.triggered) {
        condition.triggered = true;
        console.log(`[TaskScheduler] Condition triggered for task ${task.id}: ${condition.type}`);
        
        // 生成条件触发情报
        const alertItem: IntelligenceItem = {
          id: `alert-${Date.now()}`,
          type: "price_alert",
          title: `${task.symbol} Alert: ${condition.type}`,
          content: `Condition ${condition.type} ${condition.value} has been triggered`,
          symbol: task.symbol,
          timestamp: new Date(),
          importance: "high",
          data: { condition, analysis },
        };
        
        this.callbacks.onIntelligenceGenerated?.(alertItem);
      }
    }
  }

  /**
   * 生成情报项
   */
  private generateIntelligence(analysis: CFOAnalysis): IntelligenceItem {
    const { symbol, consensus, perspectives } = analysis;
    
    let title: string;
    let importance: IntelligenceItem["importance"];
    
    if (consensus.confidence > 0.7) {
      title = `${symbol} ${consensus.sentiment.toUpperCase()} Signal`;
      importance = "high";
    } else if (consensus.confidence > 0.4) {
      title = `${symbol} Analysis Update`;
      importance = "medium";
    } else {
      title = `${symbol} Market Watch`;
      importance = "low";
    }

    return {
      id: `intel-${Date.now()}`,
      type: "cfo_analysis",
      title,
      content: consensus.summary,
      symbol,
      timestamp: new Date(),
      importance,
      data: {
        sentiment: consensus.sentiment,
        confidence: consensus.confidence,
        action: consensus.action,
        bullConfidence: perspectives.bull.confidence,
        bearConfidence: perspectives.bear.confidence,
        rsi: analysis.technicalData.indicators.rsi,
      },
    };
  }

  /**
   * 将分钟间隔转换为 cron 表达式
   */
  private minutesToCron(minutes: number): string {
    // 简单的转换：每 N 分钟执行
    // 为了简化，只支持特定的间隔
    if (minutes === 1) return "* * * * *";
    if (minutes === 5) return "*/5 * * * *";
    if (minutes === 10) return "*/10 * * * *";
    if (minutes === 15) return "*/15 * * * *";
    if (minutes === 30) return "*/30 * * * *";
    if (minutes === 60) return "0 * * * *";
    if (minutes === 360) return "0 */6 * * *"; // 6小时
    if (minutes === 720) return "0 */12 * * *"; // 12小时
    if (minutes === 1440) return "0 0 * * *"; // 每天

    // 默认每15分钟
    return "*/15 * * * *";
  }
}

// ==================== 盯盘任务管理器 ====================

class WatchTaskManager {
  private scheduler: TaskScheduler;
  private tasks: Map<string, WatchTask> = new Map();
  private intelligenceHistory: IntelligenceItem[] = [];
  private maxHistorySize = 100;

  constructor(callbacks: TaskCallback = {}) {
    this.scheduler = new TaskScheduler({
      ...callbacks,
      onIntelligenceGenerated: (item) => {
        this.addIntelligence(item);
        callbacks.onIntelligenceGenerated?.(item);
      },
    });
  }

  /**
   * 创建盯盘任务
   */
  createTask(config: Omit<WatchTask, "id">): WatchTask {
    const task: WatchTask = {
      ...config,
      id: `watch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    this.tasks.set(task.id, task);
    this.scheduler.addTask(task);

    return task;
  }

  /**
   * 删除盯盘任务
   */
  deleteTask(taskId: string): boolean {
    const removed = this.scheduler.removeTask(taskId);
    if (removed) {
      this.tasks.delete(taskId);
    }
    return removed;
  }

  /**
   * 启用/禁用任务
   */
  toggleTask(taskId: string, enabled: boolean): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      task.enabled = enabled;
      // 重新调度
      this.scheduler.removeTask(taskId);
      this.scheduler.addTask(task);
      return true;
    }
    return false;
  }

  /**
   * 获取所有任务
   */
  getTasks(): WatchTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 启动所有任务
   */
  start(): void {
    this.scheduler.startAll();
  }

  /**
   * 停止所有任务
   */
  stop(): void {
    this.scheduler.stopAll();
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      ...this.scheduler.getStatus(),
      tasks: this.getTasks(),
      intelligenceCount: this.intelligenceHistory.length,
    };
  }

  /**
   * 获取情报历史
   */
  getIntelligenceHistory(limit: number = 50): IntelligenceItem[] {
    return this.intelligenceHistory.slice(-limit);
  }

  /**
   * 添加情报到历史
   */
  private addIntelligence(item: IntelligenceItem): void {
    this.intelligenceHistory.push(item);
    if (this.intelligenceHistory.length > this.maxHistorySize) {
      this.intelligenceHistory = this.intelligenceHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 清空历史
   */
  clearHistory(): void {
    this.intelligenceHistory = [];
  }
}

// ==================== 预定义任务 ====================

/**
 * 创建默认的 BTC/DOGE 监控任务
 */
export function createDefaultWatchTasks(manager: WatchTaskManager): void {
  // BTC 每5分钟技术分析
  manager.createTask({
    symbol: "BTC",
    interval: 5,
    enabled: true,
    conditions: [
      { type: "rsi_above", value: 75, triggered: false },
      { type: "rsi_below", value: 25, triggered: false },
    ],
  });

  // DOGE 每5分钟技术分析
  manager.createTask({
    symbol: "DOGE",
    interval: 5,
    enabled: true,
    conditions: [
      { type: "rsi_above", value: 75, triggered: false },
      { type: "rsi_below", value: 25, triggered: false },
    ],
  });

  // 市场概览每15分钟
  manager.createTask({
    symbol: "MARKET_OVERVIEW",
    interval: 15,
    enabled: true,
  });
}

// ==================== 导出 ====================

export { TaskScheduler, WatchTaskManager };

// 单例模式导出
let taskManagerInstance: WatchTaskManager | null = null;

export function getTaskManager(callbacks?: TaskCallback): WatchTaskManager {
  if (!taskManagerInstance) {
    taskManagerInstance = new WatchTaskManager(callbacks);
  } else if (callbacks) {
    taskManagerInstance["scheduler"].setCallbacks(callbacks);
  }
  return taskManagerInstance;
}

export default WatchTaskManager;
