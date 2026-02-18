import { MarketDatabase } from '@/lib/data/market-db';
import path from 'path';

async function test() {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
    console.log('DB Path:', dbPath);
    
    const db = new MarketDatabase(dbPath);
    await db.init();
    console.log('DB initialized');
    
    const stats = await db.getStats();
    console.log('Stats:', stats);
    
    const range = await db.getDateRange('BTCUSDT', '1m');
    console.log('Range:', range);
    
    const data = await db.queryKlines({
      symbol: 'BTCUSDT',
      interval: '1m',
      limit: 3
    });
    console.log('Data count:', data.length);
    console.log('First record:', data[0]);
    
    db.close();
    console.log('✅ Test passed!');
  } catch (e) {
    console.error('❌ Test failed:', e);
  }
}

test();
