/**
 * 自动交易执行系统
 * 
 * 根据 PA 研判自动执行交易指令
 * 包含风险控制、执行记录和回滚机制
 */

import { getPortfolioManager, type TradeOrder } from "./portfolio";
import type { PATask } from "@/lib/types/pa-task";

// 自动交易配置
export interface AutoTradeConfig {
  enabled: boolean;                    // 是否启用自动交易
  maxSingleTradeAmount: number;        // 最大单笔交易金额（USD）
  maxDailyTradeCount: number;          // 最大日交易次数
  minConfidence: number;               // 最低置信度才执行
  allowBuy: boolean;                   // 允许自动买入
  allowSell: boolean;                  // 允许自动卖出
  stopLossPercent: number;             // 自动止损百分比
  takeProfitPercent: number;           // 自动止盈百分比
  blacklist: string[];                 // 黑名单币种
  tradingHours: {                      // 交易时间限制
    start: string;                     // "09:00"
    end: string;                       // "23:00"
  } | null;
}

// 默认配置
export const DEFAULT_AUTO_TRADE_CONFIG: AutoTradeConfig = {
  enabled: false,                      // 默认关闭，需要用户手动开启
  maxSingleTradeAmount: 1000,          // 单笔最多 $1000
  maxDailyTradeCount: 5,               // 每天最多5笔
  minConfidence: 0.7,                  // 置信度>=70%才执行
  allowBuy: true,
  allowSell: true,
  stopLossPercent: 5,                  // 5%止损
  takeProfitPercent: 10,               // 10%止盈
  blacklist: [],                       // 无黑名单
  tradingHours: null,                  // 全天交易
};

// 执行记录
export interface AutoTradeExecution {
  id: string;
  taskId: string;
  timestamp: Date;
  instruction: {
    symbol: string;
    action: "buy" | "sell" | "reduce" | "hold";
    percentage: number;
    confidence: number;
  };
  execution: {
    success: boolean;
    amount: number;
    price: number;
    total: number;
    fee: number;
  };
  riskCheck: {
    passed: boolean;
    reason?: string;
  };
  config: AutoTradeConfig;
}

class AutoTrader {
  private config: AutoTradeConfig = DEFAULT_AUTO_TRADE_CONFIG;
  private executions: AutoTradeExecution[] = [];
  private dailyTradeCount: number = 0;
  private lastTradeDate: string = "";

  constructor() {
    this.loadConfig();
    this.loadExecutions();
    this.resetDailyCountIfNeeded();
  }

  // ==================== 配置管理 ====================

  getConfig(): AutoTradeConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AutoTradeConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  private loadConfig(): void {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cts_auto_trade_config");
      if (saved) {
        try {
          this.config = { ...DEFAULT_AUTO_TRADE_CONFIG, ...JSON.parse(saved) };
        } catch (error) {
          console.error("[AutoTrader] 加载配置失败", error);
        }
      }
    }
  }

  private saveConfig(): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("cts_auto_trade_config", JSON.stringify(this.config));
    }
  }

  // ==================== 执行记录 ====================

  getExecutions(limit: number = 50): AutoTradeExecution[] {
    return this.executions.slice(-limit).reverse();
  }

  private loadExecutions(): void {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cts_auto_trade_executions");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          this.executions = parsed.map((e: AutoTradeExecution) => ({
            ...e,
            timestamp: new Date(e.timestamp),
          }));
        } catch (error) {
          console.error("[AutoTrader] 加载执行记录失败", error);
        }
      }
    }
  }

  private saveExecutions(): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("cts_auto_trade_executions", JSON.stringify(this.executions));
    }
  }

  // ==================== 风险控制 ====================

  private resetDailyCountIfNeeded(): void {
    const today = new Date().toDateString();
    if (this.lastTradeDate !== today) {
      this.dailyTradeCount = 0;
      this.lastTradeDate = today;
    }
  }

  private checkRisk(instruction: PATask["tradingInstructions"][0]): { passed: boolean; reason?: string } {
    const config = this.config;

    // 1. 检查是否启用
    if (!config.enabled) {
      return { passed: false, reason: "自动交易已关闭" };
    }

    // 2. 检查置信度
    if (instruction.confidence < config.minConfidence) {
      return { passed: false, reason: `置信度 ${(instruction.confidence * 100).toFixed(0)}% 低于阈值 ${(config.minConfidence * 100).toFixed(0)}%` };
    }

    // 3. 检查交易类型
    if (instruction.action === "buy" && !config.allowBuy) {
      return { passed: false, reason: "自动买入已禁用" };
    }
    if ((instruction.action === "sell" || instruction.action === "reduce") && !config.allowSell) {
      return { passed: false, reason: "自动卖出已禁用" };
    }

    // 4. 检查黑名单
    if (config.blacklist.includes(instruction.symbol)) {
      return { passed: false, reason: `${instruction.symbol} 在黑名单中` };
    }

    // 5. 检查交易时间
    if (config.tradingHours) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      if (currentTime < config.tradingHours.start || currentTime > config.tradingHours.end) {
        return { passed: false, reason: `当前不在交易时间 (${config.tradingHours.start}-${config.tradingHours.end})` };
      }
    }

    // 6. 检查日交易次数
    this.resetDailyCountIfNeeded();
    if (this.dailyTradeCount >= config.maxDailyTradeCount) {
      return { passed: false, reason: `今日已达最大交易次数 (${config.maxDailyTradeCount})` };
    }

    return { passed: true };
  }

  // ==================== 核心执行逻辑 ====================

  /**
   * 执行 PA 交易指令
   */
  async executeInstruction(
    task: PATask,
    instruction: PATask["tradingInstructions"][0]
  ): Promise<AutoTradeExecution> {
    const portfolio = getPortfolioManager();
    const executionId = `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 1. 风控检查
    const riskCheck = this.checkRisk(instruction);

    const execution: AutoTradeExecution = {
      id: executionId,
      taskId: task.id,
      timestamp: new Date(),
      instruction: {
        symbol: instruction.symbol,
        action: instruction.action,
        percentage: instruction.percentage,
        confidence: instruction.confidence,
      },
      execution: {
        success: false,
        amount: 0,
        price: 0,
        total: 0,
        fee: 0,
      },
      riskCheck,
      config: { ...this.config },
    };

    // 风控不通过，记录并返回
    if (!riskCheck.passed) {
      this.executions.push(execution);
      this.saveExecutions();
      console.log(`[AutoTrader] 风控拦截: ${riskCheck.reason}`);
      return execution;
    }

    // 2. 计算交易金额
    const portfolioValue = portfolio.getPortfolio().totalEquity;
    const targetAmount = (portfolioValue * instruction.percentage) / 100;
    
    // 限制单笔最大金额
    const tradeAmount = Math.min(targetAmount, this.config.maxSingleTradeAmount);

    // 3. 获取当前价格
    const currentPrice = await this.getCurrentPrice(instruction.symbol);
    if (!currentPrice) {
      execution.execution.success = false;
      execution.riskCheck = { passed: false, reason: "无法获取当前价格" };
      this.executions.push(execution);
      this.saveExecutions();
      return execution;
    }

    // 4. 计算数量
    const quantity = tradeAmount / currentPrice;

    // 5. 执行交易
    const order: TradeOrder = {
      symbol: instruction.symbol,
      side: instruction.action === "buy" ? "buy" : "sell",
      type: "market",
      quantity,
      notes: `AutoTrade: ${task.type} | 置信度: ${(instruction.confidence * 100).toFixed(0)}%`,
    };

    const result = portfolio.executeTrade(order);

    // 6. 更新执行记录
    if (result.success && result.trade) {
      execution.execution = {
        success: true,
        amount: result.trade.quantity,
        price: result.trade.price,
        total: result.trade.total,
        fee: result.trade.fee,
      };
      this.dailyTradeCount++;
      console.log(`[AutoTrader] 执行成功: ${instruction.action} ${instruction.symbol} ${result.trade.quantity.toFixed(6)} @ $${result.trade.price}`);
    } else {
      execution.execution.success = false;
      execution.riskCheck = { passed: false, reason: result.error || "交易执行失败" };
      console.log(`[AutoTrader] 执行失败: ${result.error}`);
    }

    // 7. 保存记录
    this.executions.push(execution);
    this.saveExecutions();

    return execution;
  }

  /**
   * 批量执行 PA 任务中的所有指令
   */
  async executeTask(task: PATask): Promise<AutoTradeExecution[]> {
    const results: AutoTradeExecution[] = [];

    for (const instruction of task.tradingInstructions) {
      // 只执行非 hold 的指令
      if (instruction.action !== "hold") {
        const result = await this.executeInstruction(task, instruction);
        results.push(result);
      }
    }

    return results;
  }

  // ==================== 辅助方法 ====================

  private async getCurrentPrice(symbol: string): Promise<number | null> {
    // 模拟价格，实际应从 API 获取
    const mockPrices: Record<string, number> = {
      BTC: 52345.67,
      DOGE: 0.1523,
      ETH: 2845.32,
      SOL: 98.45,
    };
    return mockPrices[symbol] || null;
  }

  /**
   * 获取今日执行情况统计
   */
  getTodayStats(): {
    total: number;
    success: number;
    failed: number;
    rejected: number;
    totalAmount: number;
  } {
    this.resetDailyCountIfNeeded();
    const today = new Date().toDateString();
    const todayExecutions = this.executions.filter(e => 
      new Date(e.timestamp).toDateString() === today
    );

    return {
      total: todayExecutions.length,
      success: todayExecutions.filter(e => e.execution.success).length,
      failed: todayExecutions.filter(e => !e.execution.success && e.riskCheck.passed).length,
      rejected: todayExecutions.filter(e => !e.riskCheck.passed).length,
      totalAmount: todayExecutions
        .filter(e => e.execution.success)
        .reduce((sum, e) => sum + e.execution.total, 0),
    };
  }
}

// 单例导出
let autoTraderInstance: AutoTrader | null = null;

export function getAutoTrader(): AutoTrader {
  if (!autoTraderInstance) {
    autoTraderInstance = new AutoTrader();
  }
  return autoTraderInstance;
}

export default AutoTrader;
