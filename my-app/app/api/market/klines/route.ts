import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// 全局数据库连接（单例模式）
let db: any = null;
let dbInitPromise: Promise<any> | null = null;

async function getDb() {
  if (db) return db;
  
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const { default: duckdb } = await import('duckdb');
      const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
      db = new duckdb.Database(dbPath);
      return db;
    })();
  }
  
  return dbInitPromise;
}

// 执行SQL查询
async function query(sql: string): Promise<any[]> {
  const database = await getDb();
  
  return new Promise((resolve, reject) => {
    database.all(sql, (err: Error | null, rows: any[]) => {
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
    const before = searchParams.get('before');
    const limit = Math.min(parseInt(searchParams.get('limit') || '150'), 500);

    const intervalMap: Record<string, number> = {
      '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400,
    };
    const intervalSeconds = intervalMap[interval] || 60;
    
    let sql: string;
    
    if (interval === '1m') {
      // 1分钟线
      if (before) {
        sql = `
          SELECT * FROM (
            SELECT timestamp, open, high, low, close, volume
            FROM klines 
            WHERE symbol = '${symbol}' AND interval = '1m'
              AND timestamp < ${parseInt(before)}
            ORDER BY timestamp DESC
            LIMIT ${limit}
          ) ORDER BY timestamp ASC
        `;
      } else {
        sql = `
          SELECT * FROM (
            SELECT timestamp, open, high, low, close, volume
            FROM klines 
            WHERE symbol = '${symbol}' AND interval = '1m'
            ORDER BY timestamp DESC
            LIMIT ${limit}
          ) ORDER BY timestamp ASC
        `;
      }
    } else {
      // 聚合线
      const bucketMs = intervalSeconds * 1000;
      
      if (before) {
        sql = `
          SELECT 
            CAST(timestamp / ${bucketMs} AS BIGINT) * ${bucketMs} as timestamp,
            FIRST(open) as open,
            MAX(high) as high,
            MIN(low) as low,
            LAST(close) as close,
            SUM(volume) as volume
          FROM klines 
          WHERE symbol = '${symbol}' AND interval = '1m'
            AND timestamp < ${parseInt(before)}
          GROUP BY CAST(timestamp / ${bucketMs} AS BIGINT)
          ORDER BY timestamp DESC
          LIMIT ${limit}
        `;
      } else {
        sql = `
          SELECT 
            CAST(timestamp / ${bucketMs} AS BIGINT) * ${bucketMs} as timestamp,
            FIRST(open) as open,
            MAX(high) as high,
            MIN(low) as low,
            LAST(close) as close,
            SUM(volume) as volume
          FROM klines 
          WHERE symbol = '${symbol}' AND interval = '1m'
          GROUP BY CAST(timestamp / ${bucketMs} AS BIGINT)
          ORDER BY timestamp DESC
          LIMIT ${limit}
        `;
      }
    }

    const rows = await query(sql);

    // 聚合查询结果是倒序的，需要反转（除了1分钟线已经在子查询中处理）
    const sortedRows = interval === '1m' ? rows : rows.reverse();

    const serializedData = sortedRows.map((row: any) => ({
      timestamp: Number(row.timestamp),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume
    }));

    return NextResponse.json({
      success: true,
      data: serializedData,
      meta: { 
        symbol, 
        interval, 
        count: serializedData.length,
        before: before || null,
        start: serializedData[0]?.timestamp,
        end: serializedData[serializedData.length - 1]?.timestamp
      }
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
