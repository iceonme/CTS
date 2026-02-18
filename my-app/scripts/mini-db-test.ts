import duckdb from 'duckdb';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
const db = new duckdb.Database(dbPath);

db.all('SELECT count(*) as count FROM klines', (err, res) => {
    if (err) {
        console.error('Query Error:', err);
    } else {
        console.log('Result:', res);
    }
    db.close();
});
