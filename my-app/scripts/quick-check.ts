import { MarketDatabase } from '@/lib/data/market-db';
import path from 'path';

async function main() {
  const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
  const db = new MarketDatabase(dbPath);
  await db.init();

  const stats = await db.getStats();
  console.log('统计:', stats);

  const range = await db.getDateRange('BTCUSDT', '1m');
  console.log('数据范围:', range);

  const data = await db.queryKlines({ symbol: 'BTCUSDT', interval: '1m', limit: 3 });
  console.log('前3条:', data.map(d => ({ time: new Date(d.timestamp).toISOString(), close: d.close })));

  db.close();
}

main();
