import { MarketDatabase } from '@/lib/data/market-db';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'market.db');
const db = new MarketDatabase(dbPath);

// 测试插入一条数据
const testData = [{
  symbol: 'BTCUSDT',
  interval: '1m',
  timestamp: 1704067200000, // 2024-01-01 00:00:00
  open: 42000,
  high: 42100,
  low: 41900,
  close: 42050,
  volume: 100,
  quoteVolume: 4200000,
  takerBuyBaseVolume: 50,
  tradeCount: 1000
}];

console.log('插入前统计:', db.getStats());

const inserted = db.insertKlines(testData);
console.log('插入条数:', inserted);

console.log('插入后统计:', db.getStats());

// 查询
const data = db.queryKlines({ symbol: 'BTCUSDT', interval: '1m', limit: 10 });
console.log('查询结果:', data);

db.close();
console.log('完成');
