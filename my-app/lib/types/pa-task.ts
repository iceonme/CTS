/**
 * PA 研判任务类型定义
 * 用于 WarRoom 和自动交易系统的共享类型
 */

export interface PATask {
  id: string;
  timestamp: Date;
  type: "scheduled" | "anomaly" | "manual" | "portfolio_review";
  status: "running" | "completed" | "failed";
  // 输入
  feedsRead: {
    agent: string;
    count: number;
    highlights: string[];
  }[];
  // 异常检测
  anomalyCheck: {
    checked: boolean;
    anomaliesFound: number;
    details: string[];
  };
  // 研判过程
  analysis: {
    portfolioSnapshot: {
      totalValue: number;
      positions: { symbol: string; value: number; pnl: number }[];
    };
    marketSentiment: "bullish" | "bearish" | "neutral";
    keyInsights: string[];
    risks: string[];
    opportunities: string[];
  };
  // 交易指令（重点突出）
  tradingInstructions: {
    symbol: string;
    action: "buy" | "sell" | "hold" | "reduce";
    percentage: number; // 仓位百分比
    confidence: number;
    reasoning: string;
    executed: boolean;
  }[];
  // 执行结果
  execution?: {
    time: Date;
    orders: { symbol: string; side: string; amount: number; status: string }[];
  };
  // 自动交易执行
  autoTradeExecutions?: import("@/lib/trading/auto-trader").AutoTradeExecution[];
}
