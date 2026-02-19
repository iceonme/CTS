/**
 * Market Database - DuckDB 封装
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
  private static instance: MarketDatabase | null = null;
  private db: duckdb.Database;
  private conn: duckdb.Connection;
  private dbPath: string;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(dbPath?: string) {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = dbPath || path.join(dataDir, 'market-v2.db');
    this.db = new duckdb.Database(this.dbPath);
    this.conn = this.db.connect();
  }

  static getInstance(dbPath?: string): MarketDatabase {
    if (!MarketDatabase.instance) {
      MarketDatabase.instance = new MarketDatabase(dbPath);
    }
    return MarketDatabase.instance;
  }

  private async execSql(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn.exec(sql, (err: Error | null) => {
        if (err) {
          console.error(`[MarketDB] Exec Error: ${err.message}\nSQL: ${sql.slice(0, 500)}`);
          reject(err);
        } else resolve();
      });
    });
  }

  private async querySql(sql: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(sql, (err: Error | null, rows: any[]) => {
        if (err) {
          console.error(`[MarketDB] Query Error: ${err.message}\nSQL: ${sql.slice(0, 500)}`);
          reject(err);
        } else resolve(rows || []);
      });
    });
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        await this.execSql(`
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

        await this.execSql(`
          CREATE INDEX IF NOT EXISTS idx_klines_time 
          ON klines(symbol, interval, timestamp);
        `);
        this.initialized = true;
      } catch (e) {
        this.initPromise = null;
        throw e;
      }
    })();

    return this.initPromise;
  }

  async getDateRange(symbol: string, interval: string): Promise<{ min: Date; max: Date } | null> {
    await this.init();
    const rows = await this.querySql(`
      SELECT MIN(timestamp) as min_ts, MAX(timestamp) as max_ts 
      FROM klines 
      WHERE symbol = '${symbol}' AND interval = '${interval}'
    `);

    if (rows.length === 0 || !rows[0].min_ts) return null;

    return {
      min: new Date(Number(rows[0].min_ts)),
      max: new Date(Number(rows[0].max_ts))
    };
  }

  async insertKlines(data: KlineData[]): Promise<number> {
    await this.init();
    if (data.length === 0) return 0;
    const batchSize = 500; // 减小批大小以提高稳定性
    let totalInserted = 0;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const values = batch.map(k => `(
        '${k.symbol}', '${k.interval}', ${k.timestamp},
        ${k.open}, ${k.high}, ${k.low}, ${k.close},
        ${k.volume}, ${k.quoteVolume}, ${k.takerBuyBaseVolume}, ${k.tradeCount}
      )`).join(',');

      try {
        await this.execSql(`
          INSERT OR IGNORE INTO klines 
          (symbol, interval, timestamp, open, high, low, close, volume, quote_volume, taker_buy_base_volume, trade_count)
          VALUES ${values}
        `);
        totalInserted += batch.length;
      } catch (e: any) {
        console.error('[MarketDB] Batch insert error:', e.message);
      }
    }
    return totalInserted;
  }

  async queryKlines(params: KlineQueryParams): Promise<KlineData[]> {
    await this.init();
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
    sql += ` ORDER BY timestamp DESC LIMIT ${limit}`;

    const rows = await this.querySql(sql);

    return rows.map((row: any) => ({
      symbol: row.symbol, interval: row.interval, timestamp: Number(row.timestamp),
      open: row.open, high: row.high, low: row.low, close: row.close,
      volume: row.volume, quoteVolume: row.quoteVolume,
      takerBuyBaseVolume: row.takerBuyBaseVolume, tradeCount: row.tradeCount
    })).reverse();
  }

  async getStats(): Promise<{ totalRecords: number; symbols: string[] }> {
    await this.init();
    const countRows = await this.querySql('SELECT COUNT(*) as count FROM klines');
    const symbolsRows = await this.querySql('SELECT DISTINCT symbol FROM klines');
    return {
      totalRecords: countRows[0].count || 0,
      symbols: symbolsRows.map((r: any) => r.symbol).filter(Boolean)
    };
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

export default MarketDatabase;
