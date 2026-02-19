const duckdb = require('duckdb');
const path = require('path');
const db = new duckdb.Database('data/market-v2.db');

db.all("SELECT timestamp, COUNT(*) as count FROM klines WHERE symbol = 'BTCUSDT' AND interval = '1m' GROUP BY timestamp HAVING count > 1 LIMIT 10", (err, rows) => {
    if (err) {
        console.error('Query error:', err);
        process.exit(1);
    }
    console.log('Duplicate 1m timestamps:', JSON.stringify(rows));

    db.all("SELECT timestamp FROM klines WHERE symbol = 'BTCUSDT' AND interval = '1m' AND timestamp >= 1754350000000 AND timestamp <= 1754354000000 ORDER BY timestamp LIMIT 20", (err, rows) => {
        if (err) {
            console.error('Query error:', err);
            process.exit(1);
        }
        console.log('Sample data near 1754352000000:', JSON.stringify(rows));
        process.exit(0);
    });
});
