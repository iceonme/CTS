import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

import MarketDatabase from '@/lib/data/market-db';

async function queryDb(sql: string): Promise<any[]> {
  const db = MarketDatabase.getInstance();
  return db.queryRaw(sql);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const interval = searchParams.get('interval') || '1m';
    const before = searchParams.get('before');
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const maxLimit = (startParam && endParam) ? 2000 : 500;
    const limit = Math.min(parseInt(searchParams.get('limit') || '150'), maxLimit);

    const intervalMap: Record<string, number> = {
      '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400,
    };
    const intervalSeconds = intervalMap[interval] || 60;

    let sql: string;

    // 构建时间范围过滤条件
    const buildTimeFilter = (tablePrefix: string = '') => {
      const prefix = tablePrefix ? `${tablePrefix}.` : '';
      let filter = '';
      if (before) filter += ` AND ${prefix}timestamp < ${parseInt(before)}`;
      if (startParam) filter += ` AND ${prefix}timestamp >= ${parseInt(startParam)}`;
      if (endParam) filter += ` AND ${prefix}timestamp <= ${parseInt(endParam)}`;
      return filter;
    };

    if (interval === '1m') {
      // 1分钟线
      sql = `
        SELECT * FROM (
          SELECT timestamp, open, high, low, close, volume
          FROM klines 
          WHERE symbol = '${symbol}' AND interval = '1m'
            ${buildTimeFilter()}
          ORDER BY timestamp DESC
          LIMIT ${limit}
        ) ORDER BY timestamp ASC
      `;
    } else {
      // 聚合线
      const bucketMs = intervalSeconds * 1000;
      sql = `
        SELECT * FROM (
          SELECT 
            CAST(timestamp / ${bucketMs} AS BIGINT) * ${bucketMs} as timestamp,
            FIRST(open) as open,
            MAX(high) as high,
            MIN(low) as low,
            LAST(close) as close,
            SUM(volume) as volume
          FROM klines 
          WHERE symbol = '${symbol}' AND interval = '1m'
            ${buildTimeFilter()}
          GROUP BY CAST(timestamp / ${bucketMs} AS BIGINT)
          ORDER BY timestamp DESC
          LIMIT ${limit}
        ) sub ORDER BY timestamp ASC
      `;
    }

    const rows = await queryDb(sql);

    // 所有查询路径已在子查询中排序为 ASC
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
  }
}
