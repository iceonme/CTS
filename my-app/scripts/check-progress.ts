import { MarketDatabase } from '@/lib/data/market-db';
import path from 'path';

async function main() {
  const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
  const db = new MarketDatabase(dbPath);
  await db.init();

  const stats = await db.getStats();
  console.log('当前统计:', stats);

  const range = await db.getDateRange('BTCUSDT', '1m');
  if (range) {
    console.log('数据范围:');
    console.log('  最早:', range.min.toISOString());
    console.log('  最新:', range.max.toISOString());
    
    // 计算已有多少天的数据
    const daysDiff = (range.max.getTime() - range.min.getTime()) / (1000 * 60 * 60 * 24);
    console.log('  天数:', daysDiff.toFixed(1));
  }

  db.close();
}

main().catch(console.error);
