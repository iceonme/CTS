/**
 * 从 Binance 拉取 K线数据
 * 用法: npx tsx scripts/fetch-binance-data.ts
 */

import { MarketDatabase, type KlineData } from '@/lib/data/market-db';
import path from 'path';

const BINANCE_API_BASE = 'https://api.binance.com';

// 请求限速：Binance 限制 IP 每分钟 6000 次权重
const REQUEST_INTERVAL = 100;

interface BinanceKline {
  0: number;   // Open time
  1: string;   // Open
  2: string;   // High
  3: string;   // Low
  4: string;   // Close
  5: string;   // Volume
  6: number;   // Close time
  7: string;   // Quote asset volume
  8: number;   // Number of trades
  9: string;   // Taker buy base asset volume
  10: string;  // Taker buy quote asset volume
  11: string;  // Ignore
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchKlines(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
  limit: number = 1000
): Promise<BinanceKline[]> {
  const url = new URL(`${BINANCE_API_BASE}/api/v3/klines`);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', interval);
  url.searchParams.set('startTime', startTime.toString());
  url.searchParams.set('endTime', endTime.toString());
  url.searchParams.set('limit', limit.toString());

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Binance API error: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<BinanceKline[]>;
}

function convertBinanceToKline(
  data: BinanceKline[], 
  symbol: string, 
  interval: string
): KlineData[] {
  return data.map(item => ({
    symbol,
    interval,
    timestamp: item[0],
    open: parseFloat(item[1]),
    high: parseFloat(item[2]),
    low: parseFloat(item[3]),
    close: parseFloat(item[4]),
    volume: parseFloat(item[5]),
    quoteVolume: parseFloat(item[7]),
    takerBuyBaseVolume: parseFloat(item[9]),
    tradeCount: item[8]
  }));
}

async function fetchRange(
  db: MarketDatabase,
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<number> {
  let totalInserted = 0;
  let currentStart = startTime;
  let requestCount = 0;

  console.log(`开始拉取 ${symbol} ${interval} 数据...`);
  console.log(`时间范围: ${new Date(startTime).toISOString()} ~ ${new Date(endTime).toISOString()}`);

  while (currentStart < endTime) {
    // 限速
    if (requestCount > 0) {
      await sleep(REQUEST_INTERVAL);
    }

    try {
      const batch = await fetchKlines(symbol, interval, currentStart, endTime, 1000);
      requestCount++;

      if (batch.length === 0) {
        console.log('没有更多数据');
        break;
      }

      // 转换并存储
      const klines = convertBinanceToKline(batch, symbol, interval);
      const inserted = await db.insertKlines(klines);
      totalInserted += inserted;

      console.log(`批次 ${requestCount}: ${batch.length} 条, 新增 ${inserted} 条, 总计 ${totalInserted} 条`);

      // 更新下一次请求的起始时间
      const lastCandle = batch[batch.length - 1];
      currentStart = lastCandle[0] + 1; // +1ms 避免重复

      // 如果获取的数据少于1000条，说明已经到末尾
      if (batch.length < 1000) {
        break;
      }
    } catch (error) {
      console.error(`请求失败 (第 ${requestCount} 次):`, error);
      await sleep(5000);
    }
  }

  console.log(`\n完成! 共 ${requestCount} 次请求, 插入 ${totalInserted} 条数据`);
  return totalInserted;
}

// 主函数
async function main() {
  const symbol = 'BTCUSDT';
  const interval = '1m';

  const dbPath = path.join(process.cwd(), 'data', 'market-v2.db');
  const db = new MarketDatabase(dbPath);
  await db.init();

  // 检查已有数据，从上次中断处继续
  const existingRange = await db.getDateRange(symbol, interval);
  
  // 2025年全年 (12个月)
  const startTime = existingRange?.max?.getTime() 
    ? existingRange.max.getTime() + 1  // 从最后一条的下一秒开始
    : new Date('2025-01-01T00:00:00Z').getTime();
  const endTime = new Date('2026-01-01T00:00:00Z').getTime();

  // 如果已经完成
  if (startTime >= endTime) {
    console.log('✅ 全年数据已完成！');
    const stats = await db.getStats();
    const range = await db.getDateRange(symbol, interval);
    console.log(`总记录: ${stats.totalRecords}, 时间范围: ${range?.min.toISOString()} ~ ${range?.max.toISOString()}`);
    db.close();
    return;
  }

  console.log('='.repeat(50));
  console.log('Binance K线数据拉取工具');
  console.log('='.repeat(50));
  console.log(`交易对: ${symbol}`);
  console.log(`周期: ${interval}`);
  if (existingRange) {
    console.log(`已存在数据: ${existingRange.min.toISOString()} ~ ${existingRange.max.toISOString()}`);
  }
  console.log(`本次拉取: ${new Date(startTime).toISOString()} ~ ${new Date(endTime).toISOString()}`);
  console.log('='.repeat(50));

  const startFetchTime = Date.now();
  
  try {
    const count = await fetchRange(db, symbol, interval, startTime, endTime);
    
    // 显示统计
    const stats = await db.getStats();
    const range = await db.getDateRange(symbol, interval);
    
    console.log('\n' + '='.repeat(50));
    console.log('数据库统计:');
    console.log(`总记录数: ${stats.totalRecords}`);
    console.log(`数据范围: ${range ? `${range.min.toISOString()} ~ ${range.max.toISOString()}` : '无'}`);
    console.log(`耗时: ${((Date.now() - startFetchTime) / 1000 / 60).toFixed(2)} 分钟`);
    console.log('='.repeat(50));

    db.close();
    process.exit(0);
  } catch (error) {
    console.error('拉取失败:', error);
    db.close();
    process.exit(1);
  }
}

main();
