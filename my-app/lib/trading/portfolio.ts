import { IClock } from '../core/clock';

/**
 * 交易记录
 */
export interface TradeRecord {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  totalUsdt: number;
  timestamp: number;
  reason: string;
}

export interface Position {
  id: string; // 兼容字段
  symbol: string;
  side: "long" | "short"; // 兼容字段
  quantity: number;
  avgPrice: number;
  lastPrice: number;
  currentPrice: number; // 兼容字段 (lastPrice 的别名)
  unrealizedPnl: number;
  unrealizedPnlPercent: number; // 兼容字段
}

/**
 * 资产快照
 */
export interface PortfolioSnapshot {
  timestamp: number;
  totalEquity: number;
  balance: number;
  unrealizedPnl: number;
  positionCount: number;
}

/**
 * 虚拟持仓管理
 * 
 * 记录参赛者的资产分配、持仓和交易历史。
 */
export class VirtualPortfolio {
  private balance: number;
  private initialCapital: number;
  private positions: Map<string, Position> = new Map();
  private trades: TradeRecord[] = [];
  private snapshots: PortfolioSnapshot[] = [];
  private clock: IClock;
  private totalRealizedPnl: number = 0;

  constructor(initialCapital: number, clock: IClock) {
    this.balance = initialCapital;
    this.initialCapital = initialCapital;
    this.clock = clock;
  }

  /**
   * 执行交易
   */
  executeTrade(symbol: string, side: 'BUY' | 'SELL', price: number, quantity: number, reason: string = ''): boolean {
    const totalUsdt = price * quantity;
    const now = this.clock.now();

    if (side === 'BUY') {
      if (this.balance < totalUsdt) {
        console.warn(`[Portfolio] Insufficient balance: ${this.balance} < ${totalUsdt}`);
        return false;
      }
      this.balance -= totalUsdt;

      const currentPos = this.positions.get(symbol) || {
        id: `pos-${symbol}-${now}`,
        symbol,
        side: 'long' as const,
        quantity: 0,
        avgPrice: 0,
        lastPrice: price,
        currentPrice: price,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0
      };
      const newQuantity = currentPos.quantity + quantity;
      const newAvgPrice = (currentPos.avgPrice * currentPos.quantity + totalUsdt) / newQuantity;

      this.positions.set(symbol, {
        ...currentPos,
        quantity: newQuantity,
        avgPrice: newAvgPrice,
        lastPrice: price,
        currentPrice: price,
        unrealizedPnl: (price - newAvgPrice) * newQuantity,
        unrealizedPnlPercent: ((price - newAvgPrice) / newAvgPrice) * 100
      });
    } else {
      const currentPos = this.positions.get(symbol);
      if (!currentPos || currentPos.quantity < quantity) {
        console.warn(`[Portfolio] Insufficient position: ${currentPos?.quantity || 0} < ${quantity}`);
        return false;
      }
      this.balance += totalUsdt;

      // 计算已实现盈亏：(卖出价 - 均价) × 卖出数量
      const realized = (price - currentPos.avgPrice) * quantity;
      this.totalRealizedPnl += realized;

      const newQuantity = currentPos.quantity - quantity;
      if (newQuantity <= 0.00000001) {
        this.positions.delete(symbol);
      } else {
        this.positions.set(symbol, {
          ...currentPos,
          quantity: newQuantity,
          lastPrice: price,
          currentPrice: price,
          unrealizedPnl: (price - currentPos.avgPrice) * newQuantity,
          unrealizedPnlPercent: ((price - currentPos.avgPrice) / currentPos.avgPrice) * 100
        });
      }
    }

    this.trades.push({
      id: `trade-${now}-${Math.random().toString(36).substr(2, 5)}`,
      symbol,
      side,
      price,
      quantity,
      totalUsdt,
      timestamp: now,
      reason
    });

    return true;
  }

  /**
   * 更新最新价格（用于计算浮盈）
   */
  updatePrice(symbol: string, price: number): void {
    const pos = this.positions.get(symbol);
    if (pos) {
      pos.lastPrice = price;
      pos.currentPrice = price;
      pos.unrealizedPnl = (price - pos.avgPrice) * pos.quantity;
      pos.unrealizedPnlPercent = ((price - pos.avgPrice) / pos.avgPrice) * 100;
    }
  }

  /**
   * 获取总资产 (余额 + 持仓估值)
   */
  getTotalEquity(): number {
    let positionValue = 0;
    this.positions.forEach(pos => {
      positionValue += pos.lastPrice * pos.quantity;
    });
    return this.balance + positionValue;
  }

  /**
   * 记录资产快照
   */
  takeSnapshot(): PortfolioSnapshot {
    const totalEquity = this.getTotalEquity();
    let unrealizedPnl = 0;
    this.positions.forEach(pos => unrealizedPnl += pos.unrealizedPnl);

    const snapshot: PortfolioSnapshot = {
      timestamp: this.clock.now(),
      totalEquity,
      balance: this.balance,
      unrealizedPnl,
      positionCount: this.positions.size
    };
    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * 计算量化指标 (夏普比率, 最大回撤)
   */
  calculateMetrics() {
    if (this.snapshots.length < 2) {
      return { sharpeRatio: 0, maxDrawdown: 0 };
    }

    // 1. 计算最大回撤 (Max Drawdown)
    let maxEquity = -Infinity;
    let maxDd = 0;

    for (const s of this.snapshots) {
      if (s.totalEquity > maxEquity) {
        maxEquity = s.totalEquity;
      }
      const dd = (maxEquity - s.totalEquity) / maxEquity;
      if (dd > maxDd) {
        maxDd = dd;
      }
    }

    // 2. 计算夏普比率 (Sharpe Ratio) - 简化版 (基于采样点收益率)
    // 假设无风险利率为 0
    const returns: number[] = [];
    for (let i = 1; i < this.snapshots.length; i++) {
      const r = (this.snapshots[i].totalEquity - this.snapshots[i - 1].totalEquity) / this.snapshots[i - 1].totalEquity;
      returns.push(r);
    }

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.map(x => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b, 0) / returns.length
    );

    // 年化因子 (假设快照是按 stepMinutes 采集的，这里做一个通用的比例估算)
    // 如果 stdDev 为 0，夏普也为 0
    const sharpe = stdDev === 0 ? 0 : (avgReturn / stdDev) * Math.sqrt(returns.length);

    return {
      sharpeRatio: Number(sharpe.toFixed(4)),
      maxDrawdown: Number((maxDd * 100).toFixed(2)) // 百分比
    };
  }

  getOverview() {
    const metrics = this.calculateMetrics();
    return {
      balance: this.balance,
      totalEquity: this.getTotalEquity(),
      positions: Array.from(this.positions.values()),
      tradeCount: this.trades.length,
      snapshots: this.snapshots.length,
      // 量化指标
      sharpeRatio: metrics.sharpeRatio,
      maxDrawdown: metrics.maxDrawdown,
      // 兼容旧接口的字段
      initialBalance: this.initialCapital,
      totalReturn: this.getTotalEquity() - this.initialCapital,
      totalReturnPercent: ((this.getTotalEquity() - this.initialCapital) / this.initialCapital) * 100,
      totalRealizedPnl: this.totalRealizedPnl,
      totalUnrealizedPnl: Array.from(this.positions.values()).reduce((sum, p) => sum + p.unrealizedPnl, 0),
      trades: this.trades.map(t => ({
        ...t,
        createdAt: new Date(t.timestamp),
        total: t.totalUsdt
      }) as any),
      updatedAt: new Date(this.clock.now())
    };
  }

  /**
   * 获取基础指标 (高性能版，不包含交易映射)
   */
  getOverviewBasic() {
    return {
      balance: this.balance,
      totalEquity: this.getTotalEquity(),
      positions: Array.from(this.positions.values()),
      tradeCount: this.trades.length
    };
  }

  /**
   * 增量获取交易记录
   */
  getTradesIncremental(startIndex: number): TradeRecord[] {
    if (startIndex >= this.trades.length) return [];
    return this.trades.slice(startIndex);
  }
}

// ==================== 兼容旧版 API (Backward Compatibility) ====================

import { systemClock } from '../core/clock';

export interface TradeOrder {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  quantity: number;
  price?: number;
  notes?: string;
}

// 映射旧的 Trade 类型
export interface Trade extends TradeRecord {
  total: number;
  createdAt: Date;
  notes?: string;
}

// 映射旧的 Portfolio 类型
export interface Portfolio {
  initialBalance: number;
  balance: number;
  totalEquity: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalReturn: number;
  totalReturnPercent: number;
  positions: Position[];
  trades: Trade[];
  updatedAt: Date;
}

class PortfolioManagerWrapper {
  private vp: VirtualPortfolio;

  constructor() {
    this.vp = new VirtualPortfolio(10000, systemClock);
  }

  getPortfolio(): Portfolio {
    return this.vp.getOverview() as unknown as Portfolio;
  }

  getPositions(): Position[] {
    return this.getPortfolio().positions;
  }

  getTrades(limit: number = 20): Trade[] {
    return this.getPortfolio().trades.slice(-limit).reverse();
  }

  executeTrade(order: TradeOrder) {
    const success = this.vp.executeTrade(
      order.symbol,
      order.side.toUpperCase() as 'BUY' | 'SELL',
      order.price || 0, // 实盘场景下通常需要先获取价格
      order.quantity,
      order.notes
    );

    // 简单兼容返回结构
    if (success) {
      const lastTrade = this.vp.getOverview().trades.slice(-1)[0];
      return { success: true, trade: lastTrade };
    }
    return { success: false, error: "交易执行失败" };
  }

  updatePrice(symbol: string, price: number) {
    this.vp.updatePrice(symbol, price);
  }

  updatePrices(prices: Record<string, number>) {
    Object.entries(prices).forEach(([s, p]) => this.vp.updatePrice(s, p));
  }

  getStats() {
    const p = this.getPortfolio();
    return {
      totalTrades: p.trades.length,
      winRate: 50, // 简化
    };
  }
}

let managerInstance: PortfolioManagerWrapper | null = null;

export function getPortfolioManager(): PortfolioManagerWrapper {
  if (!managerInstance) {
    managerInstance = new PortfolioManagerWrapper();
  }
  return managerInstance;
}
