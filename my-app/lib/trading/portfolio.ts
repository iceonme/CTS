/**
 * 实盘模拟系统
 * 管理虚拟资金、持仓、交易记录和盈亏统计
 */

import type { MarketData } from "@/lib/types";

// ==================== 类型定义 ====================

export interface Position {
  id: string;
  symbol: string;
  side: "long" | "short";
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  openedAt: Date;
  lastUpdated: Date;
}

export interface Trade {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  quantity: number;
  price: number;
  total: number;
  fee: number;
  realizedPnl?: number;
  realizedPnlPercent?: number;
  relatedPositionId?: string;
  createdAt: Date;
  notes?: string;
}

export interface Portfolio {
  initialBalance: number;
  balance: number; // 可用资金
  totalEquity: number; // 总资产 = balance + 持仓价值
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalReturn: number; // 总收益率
  totalReturnPercent: number;
  positions: Position[];
  trades: Trade[];
  updatedAt: Date;
}

export interface TradeOrder {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  quantity: number;
  price?: number; // 市价单可不填
  notes?: string;
}

// ==================== 投资组合管理器 ====================

const INITIAL_BALANCE = 10000; // 初始资金 10000 USDT

class PortfolioManager {
  private portfolio: Portfolio;
  private currentPrices: Map<string, number> = new Map();

  constructor() {
    this.portfolio = this.createInitialPortfolio();
    this.loadFromStorage();
  }

  private createInitialPortfolio(): Portfolio {
    return {
      initialBalance: INITIAL_BALANCE,
      balance: INITIAL_BALANCE,
      totalEquity: INITIAL_BALANCE,
      totalUnrealizedPnl: 0,
      totalRealizedPnl: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
      positions: [],
      trades: [],
      updatedAt: new Date(),
    };
  }

  // ==================== 数据持久化 ====================

  private saveToStorage(): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("cts_portfolio", JSON.stringify(this.portfolio));
    }
  }

  private loadFromStorage(): void {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cts_portfolio");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // 恢复日期对象
          parsed.positions = parsed.positions.map((p: Position) => ({
            ...p,
            openedAt: new Date(p.openedAt),
            lastUpdated: new Date(p.lastUpdated),
          }));
          parsed.trades = parsed.trades.map((t: Trade) => ({
            ...t,
            createdAt: new Date(t.createdAt),
          }));
          parsed.updatedAt = new Date(parsed.updatedAt);
          this.portfolio = parsed;
        } catch (error) {
          console.error("[Portfolio] Failed to load from storage", error);
        }
      }
    }
  }

  // ==================== 核心方法 ====================

  /**
   * 获取投资组合
   */
  getPortfolio(): Portfolio {
    return { ...this.portfolio };
  }

  /**
   * 更新当前价格
   */
  updatePrice(symbol: string, price: number): void {
    this.currentPrices.set(symbol, price);
    this.updatePositions();
  }

  /**
   * 批量更新价格
   */
  updatePrices(prices: Record<string, number>): void {
    Object.entries(prices).forEach(([symbol, price]) => {
      this.currentPrices.set(symbol, price);
    });
    this.updatePositions();
  }

  /**
   * 执行交易
   */
  executeTrade(order: TradeOrder): { success: boolean; trade?: Trade; error?: string } {
    const { symbol, side, type, quantity, price, notes } = order;

    if (quantity <= 0) {
      return { success: false, error: "数量必须大于0" };
    }

    // 获取当前价格
    const currentPrice = price || this.currentPrices.get(symbol);
    if (!currentPrice) {
      return { success: false, error: `无法获取 ${symbol} 的当前价格` };
    }

    const tradePrice = type === "market" ? currentPrice : price!;
    const total = tradePrice * quantity;
    const fee = total * 0.001; // 0.1% 手续费
    const totalWithFee = total + fee;

    // 检查资金（买入时）
    if (side === "buy" && totalWithFee > this.portfolio.balance) {
      return { success: false, error: "资金不足" };
    }

    // 检查持仓（卖出时）
    let existingPosition = this.portfolio.positions.find(
      p => p.symbol === symbol && p.side === "long"
    );

    if (side === "sell") {
      if (!existingPosition || existingPosition.quantity < quantity) {
        return { success: false, error: "持仓不足" };
      }
    }

    // 创建交易记录
    const trade: Trade = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      side,
      type,
      quantity,
      price: tradePrice,
      total,
      fee,
      relatedPositionId: existingPosition?.id,
      createdAt: new Date(),
      notes,
    };

    // 计算已实现盈亏（卖出时）
    if (side === "sell" && existingPosition) {
      const costBasis = existingPosition.avgPrice * quantity;
      trade.realizedPnl = total - costBasis - fee;
      trade.realizedPnlPercent = (trade.realizedPnl / costBasis) * 100;
      this.portfolio.totalRealizedPnl += trade.realizedPnl;
    }

    // 更新持仓
    if (side === "buy") {
      if (existingPosition) {
        // 加仓 - 更新均价
        const oldValue = existingPosition.avgPrice * existingPosition.quantity;
        const newValue = total;
        const newQuantity = existingPosition.quantity + quantity;
        existingPosition.avgPrice = (oldValue + newValue) / newQuantity;
        existingPosition.quantity = newQuantity;
        existingPosition.lastUpdated = new Date();
      } else {
        // 新建仓
        const newPosition: Position = {
          id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          symbol,
          side: "long",
          quantity,
          avgPrice: tradePrice,
          currentPrice: tradePrice,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
          openedAt: new Date(),
          lastUpdated: new Date(),
        };
        this.portfolio.positions.push(newPosition);
      }
      // 扣除资金
      this.portfolio.balance -= totalWithFee;
    } else {
      // 卖出
      if (existingPosition) {
        if (existingPosition.quantity === quantity) {
          // 全部卖出 - 移除持仓
          this.portfolio.positions = this.portfolio.positions.filter(
            p => p.id !== existingPosition!.id
          );
        } else {
          // 部分卖出
          existingPosition.quantity -= quantity;
          existingPosition.lastUpdated = new Date();
        }
      }
      // 增加资金
      this.portfolio.balance += total - fee;
    }

    // 添加交易记录
    this.portfolio.trades.unshift(trade);

    // 限制交易记录数量
    if (this.portfolio.trades.length > 100) {
      this.portfolio.trades = this.portfolio.trades.slice(0, 100);
    }

    // 更新投资组合统计
    this.updatePortfolioStats();
    this.saveToStorage();

    return { success: true, trade };
  }

  /**
   * 更新持仓盈亏
   */
  private updatePositions(): void {
    let totalUnrealizedPnl = 0;

    this.portfolio.positions.forEach(position => {
      const currentPrice = this.currentPrices.get(position.symbol);
      if (currentPrice) {
        position.currentPrice = currentPrice;
        const marketValue = position.currentPrice * position.quantity;
        const costBasis = position.avgPrice * position.quantity;
        position.unrealizedPnl = marketValue - costBasis;
        position.unrealizedPnlPercent = (position.unrealizedPnl / costBasis) * 100;
        totalUnrealizedPnl += position.unrealizedPnl;
      }
    });

    this.portfolio.totalUnrealizedPnl = totalUnrealizedPnl;
    this.updatePortfolioStats();
  }

  /**
   * 更新投资组合统计
   */
  private updatePortfolioStats(): void {
    // 计算持仓总价值
    const positionsValue = this.portfolio.positions.reduce(
      (sum, p) => sum + p.currentPrice * p.quantity,
      0
    );

    // 总资产
    this.portfolio.totalEquity = this.portfolio.balance + positionsValue;

    // 总盈亏
    this.portfolio.totalReturn =
      this.portfolio.totalRealizedPnl + this.portfolio.totalUnrealizedPnl;
    this.portfolio.totalReturnPercent =
      (this.portfolio.totalReturn / this.portfolio.initialBalance) * 100;

    this.portfolio.updatedAt = new Date();
  }

  /**
   * 获取持仓
   */
  getPosition(symbol: string): Position | undefined {
    return this.portfolio.positions.find(p => p.symbol === symbol);
  }

  /**
   * 获取所有持仓
   */
  getPositions(): Position[] {
    return [...this.portfolio.positions];
  }

  /**
   * 获取交易历史
   */
  getTrades(limit?: number): Trade[] {
    const trades = [...this.portfolio.trades];
    return limit ? trades.slice(0, limit) : trades;
  }

  /**
   * 重置投资组合
   */
  reset(): void {
    this.portfolio = this.createInitialPortfolio();
    this.currentPrices.clear();
    this.saveToStorage();
  }

  /**
   * 获取统计数据
   */
  getStats(): {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
  } {
    const completedTrades = this.portfolio.trades.filter(t => t.realizedPnl !== undefined);
    const winningTrades = completedTrades.filter(t => (t.realizedPnl || 0) > 0);
    const losingTrades = completedTrades.filter(t => (t.realizedPnl || 0) < 0);

    const totalWin = winningTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0));

    return {
      totalTrades: completedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0,
      avgWin: winningTrades.length > 0 ? totalWin / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
      profitFactor: totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0,
    };
  }
}

// 单例模式
let portfolioManager: PortfolioManager | null = null;

export function getPortfolioManager(): PortfolioManager {
  if (!portfolioManager) {
    portfolioManager = new PortfolioManager();
  }
  return portfolioManager;
}

export default PortfolioManager;
