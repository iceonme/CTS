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

// 从1分钟数据聚合 - 使用子查询获取首尾的open/close
async function aggregateFrom1m(params: {
  symbol: string;
  intervalSeconds: number;
  start?: Date;
  end?: Date;
  limit: number;
}) {
  const { default: duckdb } = await import('duckdb');
  
  const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
  const db = new duckdb.Database(dbPath);
  
  const { symbol, intervalSeconds, start, end, limit } = params;
  
  // 计算桶大小（毫秒）
  const bucketMs = intervalSeconds * 1000;
  
  // 使用窗口函数获取每个桶的第一条和最后一条
  // 注意：DuckDB需要CAST来确保整数除法
  let sql = `
    WITH bucketed AS (
      SELECT 
        CAST(timestamp / ${bucketMs} AS BIGINT) * ${bucketMs} as bucket_time,
        timestamp, open, high, low, close, volume,
        ROW_NUMBER() OVER (PARTITION BY CAST(timestamp / ${bucketMs} AS BIGINT) ORDER BY timestamp ASC) as rn_asc,
        ROW_NUMBER() OVER (PARTITION BY CAST(timestamp / ${bucketMs} AS BIGINT) ORDER BY timestamp DESC) as rn_desc
      FROM klines 
      WHERE symbol = '${symbol}' AND interval = '1m'
      ${start ? `AND timestamp >= ${start.getTime()}` : ''}
      ${end ? `AND timestamp <= ${end.getTime()}` : ''}
    )
    SELECT 
      bucket_time,
      MAX(CASE WHEN rn_asc = 1 THEN open END) as open,
      MAX(high) as high,
      MIN(low) as low,
      MAX(CASE WHEN rn_desc = 1 THEN close END) as close,
      SUM(volume) as volume
    FROM bucketed
    GROUP BY bucket_time
    ORDER BY bucket_time ASC
    LIMIT ${limit}
  `;

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
    const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 1000);

    // 周期映射（秒）
    const intervalMap: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
    };

    const intervalSeconds = intervalMap[interval] || 60;
    
    let data;
    
    // 如果是1分钟线，直接查询；否则从1分钟聚合
    if (interval === '1m') {
      data = await queryKlines({
        symbol,
        interval: '1m',
        start: start ? new Date(start) : undefined,
        end: end ? new Date(end) : undefined,
        limit
      });
    } else {
      data = await aggregateFrom1m({
        symbol,
        intervalSeconds,
        start: start ? new Date(start) : undefined,
        end: end ? new Date(end) : undefined,
        limit
      });
    }

    // 转换字段名
    const serializedData = (data as any[]).map(row => ({
      timestamp: Number(row.timestamp || row.bucket_time),
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
