import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// 获取最新的N条1分钟K线（用于初始加载）
async function queryLatest1m(symbol: string, limit: number) {
  const { default: duckdb } = await import('duckdb');
  const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
  const db = new duckdb.Database(dbPath);
  
  // 先按时间倒序取最新limit条，再正序返回
  const sql = `
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

  return new Promise((resolve, reject) => {
    db.all(sql, (err: Error | null, rows: any[]) => {
      db.close();
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// 获取指定时间范围前的1分钟K线（用于加载历史）
async function queryHistory1m(symbol: string, beforeTimestamp: number, limit: number) {
  const { default: duckdb } = await import('duckdb');
  const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
  const db = new duckdb.Database(dbPath);
  
  const sql = `
    SELECT timestamp, open, high, low, close, volume
    FROM (
      SELECT timestamp, open, high, low, close, volume
      FROM klines 
      WHERE symbol = '${symbol}' AND interval = '1m'
        AND timestamp < ${beforeTimestamp}
      ORDER BY timestamp DESC
      LIMIT ${limit}
    )
    ORDER BY timestamp ASC
  `;

  return new Promise((resolve, reject) => {
    db.all(sql, (err: Error | null, rows: any[]) => {
      db.close();
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// 获取最新的聚合K线（用于初始加载）
async function aggregateLatest(symbol: string, intervalSeconds: number, limit: number) {
  const { default: duckdb } = await import('duckdb');
  const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
  const db = new duckdb.Database(dbPath);
  
  const bucketMs = intervalSeconds * 1000;
  
  // 先聚合，再取最新的limit条
  const sql = `
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

  return new Promise((resolve, reject) => {
    db.all(sql, (err: Error | null, rows: any[]) => {
      db.close();
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// 获取指定时间前的聚合K线（用于加载历史）
async function aggregateHistory(symbol: string, intervalSeconds: number, beforeTimestamp: number, limit: number) {
  const { default: duckdb } = await import('duckdb');
  const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
  const db = new duckdb.Database(dbPath);
  
  const bucketMs = intervalSeconds * 1000;
  const beforeBucket = Math.floor(beforeTimestamp / bucketMs) * bucketMs;
  
  const sql = `
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
          AND timestamp < ${beforeBucket}
      )
      GROUP BY bucket_time
      ORDER BY bucket_time DESC
      LIMIT ${limit}
    )
    ORDER BY bucket_time ASC
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
    const before = searchParams.get('before');  // 加载此时间戳之前的数据
    const limit = Math.min(parseInt(searchParams.get('limit') || '150'), 500);

    // 周期映射（秒）
    const intervalMap: Record<string, number> = {
      '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400,
    };
    const intervalSeconds = intervalMap[interval] || 60;
    
    let data;
    
    if (interval === '1m') {
      // 1分钟线
      if (before) {
        data = await queryHistory1m(symbol, parseInt(before), limit);
      } else {
        data = await queryLatest1m(symbol, limit);
      }
    } else {
      // 聚合线
      if (before) {
        data = await aggregateHistory(symbol, intervalSeconds, parseInt(before), limit);
      } else {
        data = await aggregateLatest(symbol, intervalSeconds, limit);
      }
    }

    // 转换字段名
    const serializedData = (data as any[]).map(row => ({
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
