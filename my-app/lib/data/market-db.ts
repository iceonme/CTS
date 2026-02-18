/**
 * Market Database - DuckDB 封装
 * ⚠️ 只在服务端使用！不要在客户端导入此文件
 */

import duckdb from 'duckdb';
import path from 'path';
import fs from 'fs';

export interface KlineData {
  symbol: string;
  interval: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  takerBuyBaseVolume: number;
  tradeCount: number;
}

export interface KlineQueryParams {
  symbol: string;
  interval: string;
  start?: Date;
  end?: Date;
  limit?: number;
}

// 辅助函数：执行 SQL 并返回结果
function queryAll(db: duckdb.Database, sql: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, (err: Error | null, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function exec(db: duckdb.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export class MarketDatabase {
  private db: duckdb.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = dbPath || path.join(dataDir, 'market-v2.db');
    this.db = new duckdb.Database(this.dbPath);
  }

  async init(): Promise<void> {
    await exec(this.db, `
      CREATE TABLE IF NOT EXISTS klines (
        symbol VARCHAR,
        interval VARCHAR,
        timestamp BIGINT,
        open DOUBLE,
        high DOUBLE,
        low DOUBLE,
        close DOUBLE,
        volume DOUBLE,
        quote_volume DOUBLE,
        taker_buy_base_volume DOUBLE,
        trade_count INTEGER,
        PRIMARY KEY (symbol, interval, timestamp)
      );
    `);

    await exec(this.db, `
      CREATE INDEX IF NOT EXISTS idx_klines_time 
      ON klines(symbol, interval, timestamp);
    `);
  }

  async getDateRange(symbol: string, interval: string): Promise<{ min: Date; max: Date } | null> {
    const rows = await queryAll(this.db, `
      SELECT MIN(timestamp) as min_ts, MAX(timestamp) as max_ts 
      FROM klines 
      WHERE symbol = '${symbol}' AND interval = '${interval}'
    `);
    const result = Array.isArray(rows) ? rows : Object.values(rows || {});

    if (result.length === 0 || !(result[0] as any).min_ts || !(result[0] as any).max_ts) return null;
    
    return {
      min: new Date(Number((result[0] as any).min_ts)),
      max: new Date(Number((result[0] as any).max_ts))
    };
  }

  async insertKlines(data: KlineData[]): Promise<number> {
    if (data.length === 0) return 0;

    const batchSize = 1000;
    let totalInserted = 0;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      const values = batch.map(k => `(
        '${k.symbol}', '${k.interval}', ${k.timestamp},
        ${k.open}, ${k.high}, ${k.low}, ${k.close},
        ${k.volume}, ${k.quoteVolume}, ${k.takerBuyBaseVolume}, ${k.tradeCount}
      )`).join(',');

      try {
        await exec(this.db, `
          INSERT OR IGNORE INTO klines 
          (symbol, interval, timestamp, open, high, low, close, volume, quote_volume, taker_buy_base_volume, trade_count)
          VALUES ${values}
        `);
        totalInserted += batch.length;
      } catch (e: any) {
        console.error('批量插入错误:', e.message);
      }
    }

    return totalInserted;
  }

  async queryKlines(params: KlineQueryParams): Promise<KlineData[]> {
    const { symbol, interval, start, end, limit = 1000 } = params;
    
    let sql = `
      SELECT symbol, interval, timestamp, open, high, low, close, 
        volume, quote_volume as quoteVolume, 
        taker_buy_base_volume as takerBuyBaseVolume, 
        trade_count as tradeCount
      FROM klines 
      WHERE symbol = '${symbol}' AND interval = '${interval}'
    `;

    if (start) sql += ` AND timestamp >= ${start.getTime()}`;
    if (end) sql += ` AND timestamp <= ${end.getTime()}`;
    sql += ` ORDER BY timestamp ASC LIMIT ${limit}`;

    const rows = await queryAll(this.db, sql);
    const result = Array.isArray(rows) ? rows : Object.values(rows || {});
    
    return result.map((row: any) => ({
      symbol: row.symbol, interval: row.interval, timestamp: Number(row.timestamp),
      open: row.open, high: row.high, low: row.low, close: row.close,
      volume: row.volume, quoteVolume: row.quoteVolume,
      takerBuyBaseVolume: row.takerBuyBaseVolume, tradeCount: row.tradeCount
    }));
  }

  async getStats(): Promise<{ totalRecords: number; symbols: string[] }> {
    const countRows = await queryAll(this.db, 'SELECT COUNT(*) as count FROM klines');
    const countResult = Array.isArray(countRows) ? countRows : Object.values(countRows || {});
    
    const symbolRows = await queryAll(this.db, 'SELECT DISTINCT symbol FROM klines');
    const symbolsResult = Array.isArray(symbolRows) ? symbolRows : Object.values(symbolRows || {});

    return {
      totalRecords: countResult.length > 0 ? (countResult[0] as any).count || 0 : 0,
      symbols: symbolsResult.map((r: any) => r.symbol).filter(Boolean)
    };
  }

  close(): void {
    this.db.close();
  }
}

export default MarketDatabase;
