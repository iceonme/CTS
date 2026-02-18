import { MarketDatabase } from '../lib/data/market-db';
import path from 'path';

async function testQuery() {
    const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
    console.log('Testing DB at:', dbPath);

    const db = new MarketDatabase(dbPath);
    await db.init();

    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-01-01T23:59:59Z');

    console.time('query_1000');
    const klines = await db.queryKlines({
        symbol: 'BTCUSDT',
        interval: '1m',
        start,
        limit: 1000
    });
    console.timeEnd('query_1000');

    console.log('Query result count:', klines.length);
    if (klines.length > 0) {
        console.log('First candle:', new Date(klines[0].timestamp).toISOString(), 'Price:', klines[0].close);
    }

    const stats = await db.getStats();
    console.log('DB Stats:', stats);

    db.close();
}

testQuery().catch(console.error);
