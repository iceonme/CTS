/**
 * 测试交易 API
 * POST /api/test/trade
 * 
 * 测试新的简单交易接口
 */

import { getCFOAgent } from "@/lib/agents/cfo";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, side, amount, quantity, reason } = body;

    // 调用 CFO 的简单交易方法
    const cfo = getCFOAgent();
    const result = await cfo.executeTrade({
      symbol,
      side,
      amount,
      quantity,
      reason,
    });

    return NextResponse.json(result);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

// 也支持 GET 获取当前 Portfolio
export async function GET() {
  try {
    const { getPortfolioManager } = await import("@/lib/trading/portfolio");
    const portfolio = getPortfolioManager();
    const data = portfolio.getPortfolio();

    return NextResponse.json({
      success: true,
      portfolio: {
        totalEquity: data.totalEquity,
        balance: data.balance,
        positions: data.positions.map(p => ({
          symbol: p.symbol,
          quantity: p.quantity,
          avgPrice: p.avgPrice,
          currentPrice: p.currentPrice,
          unrealizedPnl: p.unrealizedPnl,
        })),
        trades: data.trades.slice(0, 5).map(t => ({
          symbol: t.symbol,
          side: t.side,
          quantity: t.quantity,
          price: t.price,
          total: t.total,
          createdAt: t.createdAt,
        })),
      },
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
