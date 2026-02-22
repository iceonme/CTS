import { findPivotLows, findPivotHighs, getRecentPivots } from '../lib/trading/pivot-detector';
import { calculateVolatility, analyzeVolatility } from '../lib/trading/volatility-calculator';
import { KlineData } from '../lib/data/market-db';

/**
 * GridContestant 核心工具测试脚本
 * 
 * 用模拟K线数据验证枢轴点检测和波动率计算的正确性。
 */

// ==================== 辅助工具 ====================

function makeKline(timestamp: number, open: number, high: number, low: number, close: number): KlineData {
    return {
        symbol: 'BTCUSDT',
        interval: '15m',
        timestamp,
        open,
        high,
        low,
        close,
        volume: 100,
        quoteVolume: 10000,
        takerBuyBaseVolume: 50,
        tradeCount: 200,
    };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`  ✅ ${message}`);
        passed++;
    } else {
        console.log(`  ❌ ${message}`);
        failed++;
    }
}

// ==================== 测试 1：枢轴低点检测 ====================

function testPivotLows() {
    console.log('\n📊 测试 1：枢轴低点检测');

    // 构造一个 V 型走势：100, 98, 95, 92, 90, 92, 95, 98, 100, 102, 100
    const klines = [
        makeKline(1000, 100, 101, 100, 100),
        makeKline(2000, 98, 99, 98, 98),
        makeKline(3000, 95, 96, 95, 95),
        makeKline(4000, 92, 93, 92, 92),
        makeKline(5000, 90, 91, 90, 90),   // ← 枢轴低点
        makeKline(6000, 92, 93, 92, 92),
        makeKline(7000, 95, 96, 95, 95),
        makeKline(8000, 98, 99, 98, 98),
        makeKline(9000, 100, 101, 100, 100),
        makeKline(10000, 102, 103, 102, 102),
        makeKline(11000, 100, 101, 100, 100),
    ];

    const pivots = findPivotLows(klines, 2);
    assert(pivots.length === 1, `应找到 1 个低点（实际: ${pivots.length}）`);
    assert(pivots[0]?.price === 90, `低点价格应为 90（实际: ${pivots[0]?.price}）`);
    assert(pivots[0]?.index === 4, `低点索引应为 4（实际: ${pivots[0]?.index}）`);
}

// ==================== 测试 2：枢轴高点检测 ====================

function testPivotHighs() {
    console.log('\n📊 测试 2：枢轴高点检测');

    // 构造一个倒 V 型走势
    const klines = [
        makeKline(1000, 90, 91, 90, 90),
        makeKline(2000, 93, 94, 93, 93),
        makeKline(3000, 96, 97, 96, 96),
        makeKline(4000, 99, 100, 99, 99),
        makeKline(5000, 102, 105, 102, 102), // ← 枢轴高点 (high=105)
        makeKline(6000, 99, 100, 99, 99),
        makeKline(7000, 96, 97, 96, 96),
        makeKline(8000, 93, 94, 93, 93),
        makeKline(9000, 90, 91, 90, 90),
        makeKline(10000, 88, 89, 88, 88),
        makeKline(11000, 86, 87, 86, 86),
    ];

    const pivots = findPivotHighs(klines, 2);
    assert(pivots.length === 1, `应找到 1 个高点（实际: ${pivots.length}）`);
    assert(pivots[0]?.price === 105, `高点价格应为 105（实际: ${pivots[0]?.price}）`);
}

// ==================== 测试 3：多个枢轴点 ====================

function testMultiplePivots() {
    console.log('\n📊 测试 3：多个枢轴点检测');

    // W 型走势带两个低点和一个高点
    const klines = [
        makeKline(1000, 100, 101, 100, 100),
        makeKline(2000, 95, 96, 95, 95),
        makeKline(3000, 90, 91, 90, 90),    // ← 低点1
        makeKline(4000, 95, 96, 95, 95),
        makeKline(5000, 100, 101, 100, 100),
        makeKline(6000, 105, 110, 105, 105),   // ← 高点1 (high=110)
        makeKline(7000, 100, 101, 100, 100),
        makeKline(8000, 95, 96, 95, 95),
        makeKline(9000, 88, 89, 88, 88),    // ← 低点2
        makeKline(10000, 95, 96, 95, 95),
        makeKline(11000, 100, 101, 100, 100),
    ];

    const lows = findPivotLows(klines, 2);
    const highs = findPivotHighs(klines, 2);

    assert(lows.length === 2, `应找到 2 个低点（实际: ${lows.length}）`);
    assert(highs.length === 1, `应找到 1 个高点（实际: ${highs.length}）`);
    assert(lows[0]?.price === 90, `第一个低点价格应为 90（实际: ${lows[0]?.price}）`);
    assert(lows[1]?.price === 88, `第二个低点价格应为 88（实际: ${lows[1]?.price}）`);
    assert(highs[0]?.price === 110, `高点价格应为 110（实际: ${highs[0]?.price}）`);
}

// ==================== 测试 4：getRecentPivots ====================

function testGetRecentPivots() {
    console.log('\n📊 测试 4：getRecentPivots 取最近 N 个');

    // 3个低点，2个高点的走势
    const klines = [
        makeKline(1000, 100, 101, 100, 100),
        makeKline(2000, 95, 96, 95, 95),
        makeKline(3000, 90, 91, 90, 90),    // 低点 90
        makeKline(4000, 95, 96, 95, 95),
        makeKline(5000, 100, 110, 100, 100),   // 高点 110
        makeKline(6000, 95, 96, 95, 95),
        makeKline(7000, 85, 86, 85, 85),    // 低点 85
        makeKline(8000, 95, 96, 95, 95),
        makeKline(9000, 100, 108, 100, 100),   // 高点 108
        makeKline(10000, 95, 96, 95, 95),
        makeKline(11000, 88, 89, 88, 88),    // 低点 88
        makeKline(12000, 95, 96, 95, 95),
        makeKline(13000, 100, 101, 100, 100),
    ];

    const result = getRecentPivots(klines, 2, 2);

    assert(result.lows.length === 2, `应返回 2 个低点（实际: ${result.lows.length}）`);
    assert(result.highs.length === 2, `应返回 2 个高点（实际: ${result.highs.length}）`);

    // lows 按升序排列
    assert(result.lows[0] <= result.lows[1], `低点应按升序排列`);
    // highs 按降序排列
    assert(result.highs[0] >= result.highs[1], `高点应按降序排列`);
}

// ==================== 测试 5：波动率计算 ====================

function testVolatility() {
    console.log('\n📊 测试 5：波动率计算');

    const klines = [
        makeKline(1000, 100, 105, 95, 100),  // high=105, low=95
        makeKline(2000, 100, 102, 98, 100),  // high=102, low=98
        makeKline(3000, 100, 103, 97, 100),  // high=103, low=97
    ];

    // 最高=105，最低=95，波动率 = (105-95)/95 * 100 = 10.526%
    const vol = calculateVolatility(klines);
    assert(Math.abs(vol - 10.526) < 0.1, `波动率应约为 10.53%（实际: ${vol.toFixed(2)}%）`);

    const result = analyzeVolatility(klines, 3, 5);
    assert(result.inRange === false, `10.53% 波动率超出 [3%, 5%] 范围`);
    assert(result.highest === 105, `最高价应为 105（实际: ${result.highest}）`);
    assert(result.lowest === 95, `最低价应为 95（实际: ${result.lowest}）`);
}

// ==================== 测试 6：低波动率范围内 ====================

function testVolatilityInRange() {
    console.log('\n📊 测试 6：波动率在范围内');

    const klines = [
        makeKline(1000, 100, 102, 99.5, 100),
        makeKline(2000, 100, 101.5, 99, 100),
        makeKline(3000, 100, 103, 99, 100),
    ];

    // 最高=103，最低=99，波动率 = (103-99)/99 * 100 = 4.04%
    const result = analyzeVolatility(klines, 3, 5);
    assert(result.inRange === true, `4.04% 波动率应在 [3%, 5%] 范围内（实际: ${result.volatility.toFixed(2)}%）`);
}

// ==================== 测试 7：数据不足时的兜底 ====================

function testEdgeCases() {
    console.log('\n📊 测试 7：边界情况');

    // 空数组
    const emptyLows = findPivotLows([], 5);
    assert(emptyLows.length === 0, `空数组应返回空结果`);

    // 数据太少
    const fewKlines = [makeKline(1000, 100, 101, 99, 100)];
    const fewLows = findPivotLows(fewKlines, 5);
    assert(fewLows.length === 0, `数据不足（1根, N=5）应返回空结果`);

    // 空数组波动率
    const vol = calculateVolatility([]);
    assert(vol === 0, `空数组波动率应为 0`);
}

// ==================== 运行所有测试 ====================

function runAllTests() {
    console.log('='.repeat(50));
    console.log('🧪 GridContestant 核心工具测试');
    console.log('='.repeat(50));

    testPivotLows();
    testPivotHighs();
    testMultiplePivots();
    testGetRecentPivots();
    testVolatility();
    testVolatilityInRange();
    testEdgeCases();

    console.log('\n' + '='.repeat(50));
    console.log(`📋 总结: ${passed} 通过, ${failed} 失败`);
    console.log('='.repeat(50));

    if (failed > 0) {
        process.exit(1);
    }
}

runAllTests();
