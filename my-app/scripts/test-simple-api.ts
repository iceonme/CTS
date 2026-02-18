import duckdb from 'duckdb';
import path from 'path';

async function test() {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
    console.log('Opening DB:', dbPath);
    
    const db = new duckdb.Database(dbPath);
    
    const result = await new Promise((resolve, reject) => {
      db.all(
        `SELECT timestamp, open, high, low, close, volume 
         FROM klines 
         WHERE symbol = 'BTCUSDT' AND interval = '1m'
         LIMIT 3`,
        (err: Error | null, rows: any[]) => {
          db.close();
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    console.log('Result:', result);
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
