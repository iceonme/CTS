const duckdb = require('duckdb');
const db = new duckdb.Database('data/market-v2.db');

const symbol = 'BTCUSDT';
const before = 1754352000000;

console.log('--- Checking 1m data near ' + before + ' ---');
db.all(`SELECT timestamp, open, high, low, close FROM klines WHERE symbol = '${symbol}' AND interval = '1m' AND timestamp <= ${before} ORDER BY timestamp DESC LIMIT 5`, (err, rows) => {
    if (err) console.error(err);
    else console.log('1m results:', JSON.stringify(rows, null, 2));

    console.log('\n--- Checking 1d aggregation near ' + before + ' ---');
    const bucketMs = 86400000;
    db.all(`
        SELECT 
            CAST(timestamp / ${bucketMs} AS BIGINT) * ${bucketMs} as timestamp,
            COUNT(*) as raw_count
        FROM klines 
        WHERE symbol = '${symbol}' AND interval = '1m'
            AND timestamp < ${before}
        GROUP BY CAST(timestamp / ${bucketMs} AS BIGINT)
        ORDER BY timestamp DESC
        LIMIT 5
    `, (err, rows) => {
        if (err) console.error(err);
        else console.log('1d aggregation results:', JSON.stringify(rows, null, 2));
        process.exit(0);
    });
});
