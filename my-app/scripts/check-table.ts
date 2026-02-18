import { MarketDatabase } from '@/lib/data/market-db';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'market.db');
const db = new MarketDatabase(dbPath);

// 检查表是否存在
const tables = (db as any).db.prepare("SHOW TABLES").all();
console.log('Tables:', tables);

// 检查表结构
try {
  const schema = (db as any).db.prepare("DESCRIBE klines").all();
  console.log('Schema:', schema);
} catch (e) {
  console.log('DESCRIBE error:', e);
}

// 直接查询
const all = (db as any).db.prepare("SELECT * FROM klines LIMIT 5").all();
console.log('All data:', all);

db.close();
