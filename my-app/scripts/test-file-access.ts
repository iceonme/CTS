import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
try {
    console.log('Attempting to read file:', dbPath);
    const fd = fs.openSync(dbPath, 'r');
    console.log('Successfully opened file descriptor');
    fs.closeSync(fd);
} catch (err) {
    console.error('Failed to open file:', err);
}
