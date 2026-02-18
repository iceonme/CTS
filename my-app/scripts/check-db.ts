import { MarketDatabase } from '@/lib/data/market-db';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'market.db');
console.log('数据库路径:', dbPath);

const db = new MarketDatabase(dbPath);
const stats = db.getStats();
const range = db.getDateRange('BTCUSDT', '1m');

console.log('\n数据库统计:');
console.log('总记录数:', stats.totalRecords);
console.log('交易对:', stats.symbols);
console.log('数据范围:', range);
if (range) {
  console.log('最早:', range.min.toISOString());
  console.log('最新:', range.max.toISOString());
}

// 查询几条数据看看
const data = db.queryKlines({ symbol: 'BTCUSDT', interval: '1m', limit: 5 });
console.log('\n前5条数据:');
data.forEach(d => console.log(new Date(d.timestamp).toISOString(), d.open, d.close));

db.close();
