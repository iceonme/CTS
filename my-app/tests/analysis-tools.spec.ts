/**
 * Analysis Tools 单元测试
 * Phase 1 验证
 */

import { test, expect } from '@playwright/test';
import { 
    calculateRSI, 
    calculateSMA, 
    calculateEMA, 
    calculateMACD,
    createAnalysisTools
} from '../lib/skills/tools/analysis-tools';
import { toolRegistry } from '../lib/skills/core/tool-registry';

test.describe('Phase 1: Analysis Tools', () => {
    
    test('1.1 计算函数被正确导出', () => {
        expect(typeof calculateRSI).toBe('function');
        expect(typeof calculateSMA).toBe('function');
        expect(typeof calculateEMA).toBe('function');
        expect(typeof calculateMACD).toBe('function');
        expect(typeof createAnalysisTools).toBe('function');
    });

    test('1.2 createAnalysisTools 创建符合 MCP 标准的 Tools', () => {
        const mockDb = { queryKlines: async () => [] };
        const tools = createAnalysisTools(mockDb);
        
        expect(tools).toHaveLength(3);
        tools.forEach(tool => {
            expect(tool).toHaveProperty('id');
            expect(tool).toHaveProperty('name');
            expect(tool).toHaveProperty('description');
            expect(tool).toHaveProperty('parameters');
            expect(tool).toHaveProperty('execute');
            expect(typeof tool.execute).toBe('function');
            expect(tool.parameters.type).toBe('object');
        });
    });

    test('1.3 Tools 可以注册到 Registry', () => {
        const mockDb = { queryKlines: async () => [] };
        const tools = createAnalysisTools(mockDb);
        
        // 清理
        const initialCount = toolRegistry.getAll().length;
        
        // 注册
        tools.forEach(tool => {
            toolRegistry.register(tool);
        });

        // 验证
        expect(toolRegistry.getAll().length).toBe(initialCount + 3);
        expect(toolRegistry.has('indicator:rsi')).toBe(true);
        expect(toolRegistry.has('indicator:ma')).toBe(true);
        expect(toolRegistry.has('indicator:macd')).toBe(true);
    });

    test('1.4 RSI 计算正确', () => {
        // 已知结果的测试数据
        const prices = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 46.14, 45.89, 46.36, 46.39, 46.20];
        const rsi = calculateRSI(prices, 14);
        // RSI 应该在 50-70 之间（上涨趋势）
        expect(rsi).toBeGreaterThan(50);
        expect(rsi).toBeLessThan(80);
    });

    test('1.5 SMA 计算正确', () => {
        const prices = [1, 2, 3, 4, 5];
        const sma = calculateSMA(prices, 3);
        expect(sma).toBe(4); // (3+4+5)/3 = 4
    });

    test('1.6 EMA 计算正确', () => {
        const prices = [10, 11, 12, 13, 14];
        const ema = calculateEMA(prices, 3);
        expect(ema).toBeGreaterThan(10);
        expect(ema).toBeLessThan(15);
    });

    test('1.7 MACD 计算正确', () => {
        const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5); // 上涨趋势
        const macd = calculateMACD(prices);
        
        expect(macd).toHaveProperty('macd');
        expect(macd).toHaveProperty('signal');
        expect(macd).toHaveProperty('histogram');
        expect(macd).toHaveProperty('trend');
    });

    test('1.8 极端情况处理', () => {
        // 数据不足
        const shortPrices = [1, 2];
        const rsi = calculateRSI(shortPrices, 14);
        expect(rsi).toBe(50); // 默认值

        const sma = calculateSMA(shortPrices, 10);
        expect(sma).toBe(2); // 返回最后一个价格
    });
});

test.describe('Phase 1.5: createAnalysisTools', () => {
    test('创建的 Tools 参数结构正确', () => {
        const mockDb = { queryKlines: async () => [] };
        const tools = createAnalysisTools(mockDb);
        
        const rsiTool = tools.find(t => t.id === 'indicator:rsi');
        expect(rsiTool).toBeDefined();
        expect(rsiTool!.parameters.required).toContain('symbol');
        expect(rsiTool!.parameters.properties).toHaveProperty('symbol');
        expect(rsiTool!.parameters.properties).toHaveProperty('endTime');
    });
});
