import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import duckdb from 'duckdb';

const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');

// 执行SQL查询
function query(db: duckdb.Database, sql: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, (err: Error | null, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

export async function GET(request: NextRequest) {
  let db: duckdb.Database | null = null;
  
  try {
    const { searchParams } = new URL(request.url);
    
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const interval = searchParams.get('interval') || '1m';
    const before = searchParams.get('before');
    const limit = Math.min(parseInt(searchParams.get('limit') || '150'), 500);

    // 周期映射（秒）
    const intervalMap: Record<string, number> = {
      '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400,
    };
    const intervalSeconds = intervalMap[interval] || 60;
    
    // 创建新连接
    db = new duckdb.Database(dbPath);
    
    let sql: string;
    
    if (interval === '1m') {
      // 1分钟线
      if (before) {
        // 加载历史
        sql = `
          SELECT timestamp, open, high, low, close, volume
          FROM (
            SELECT timestamp, open, high, low, close, volume
            FROM klines 
            WHERE symbol = '${symbol}' AND interval = '1m'
              AND timestamp < ${parseInt(before)}
            ORDER BY timestamp DESC
            LIMIT ${limit}
          )
          ORDER BY timestamp ASC
        `;
      } else {
        // 加载最新
        sql = `
          SELECT timestamp, open, high, low, close, volume
          FROM (
            SELECT timestamp, open, high, low, close, volume
            FROM klines 
            WHERE symbol = '${symbol}' AND interval = '1m'
            ORDER BY timestamp DESC
            LIMIT ${limit}
          )
          ORDER BY timestamp ASC
        `;
      }
    } else {
      // 聚合线
      const bucketMs = intervalSeconds * 1000;
      
      if (before) {
        // 使用更简单直接的聚合方式
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
          SELECT bucket_time as timestamp, open, high, low, close, volume
          FROM (
            SELECT 
              bucket_time,
              MAX(CASE WHEN rn_asc = 1 THEN open END) as open,
              MAX(high) as high,
              MIN(low) as low,
              MAX(CASE WHEN rn_desc = 1 THEN close END) as close,
              SUM(volume) as volume
            FROM (
              SELECT 
                CAST(timestamp / ${bucketMs} AS BIGINT) * ${bucketMs} as bucket_time,
                open, high, low, close, volume,
                ROW_NUMBER() OVER (PARTITION BY CAST(timestamp / ${bucketMs} AS BIGINT) ORDER BY timestamp ASC) as rn_asc,
                ROW_NUMBER() OVER (PARTITION BY CAST(timestamp / ${bucketMs} AS BIGINT) ORDER BY timestamp DESC) as rn_desc
              FROM klines 
              WHERE symbol = '${symbol}' AND interval = '1m'
            )
            GROUP BY bucket_time
            ORDER BY bucket_time DESC
            LIMIT ${limit}
          )
          ORDER BY bucket_time ASC
        `;
      }
    }

    const rows = await query(db, sql);

    // 转换字段名
    const serializedData = rows.map((row: any) => ({
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
  } finally {
    if (db) {
      db.close();
    }
  }
}
