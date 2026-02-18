import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// 动态导入 duckdb，避免 webpack 打包问题
async function queryKlines(params: {
  symbol: string;
  interval: string;
  start?: Date;
  end?: Date;
  limit: number;
}) {
  const { default: duckdb } = await import('duckdb');
  
  const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
  const db = new duckdb.Database(dbPath);
  
  const { symbol, interval, start, end, limit } = params;
  
  let sql = `
    SELECT timestamp, open, high, low, close, volume
    FROM klines 
    WHERE symbol = '${symbol}' AND interval = '${interval}'
  `;
  
  if (start) {
    sql += ` AND timestamp >= ${start.getTime()}`;
  }
  if (end) {
    sql += ` AND timestamp <= ${end.getTime()}`;
  }
  
  sql += ` ORDER BY timestamp ASC LIMIT ${limit}`;

  return new Promise((resolve, reject) => {
    db.all(sql, (err: Error | null, rows: any[]) => {
      db.close();
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const interval = searchParams.get('interval') || '1m';
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const limit = Math.min(parseInt(searchParams.get('limit') || '1000'), 5000);

    const data = await queryKlines({
      symbol,
      interval,
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
      limit
    });

    // 转换 BigInt 为 Number
    const serializedData = (data as any[]).map(row => ({
      ...row,
      timestamp: Number(row.timestamp)
    }));

    return NextResponse.json({
      success: true,
      data: serializedData,
      meta: { symbol, interval, count: serializedData.length }
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
