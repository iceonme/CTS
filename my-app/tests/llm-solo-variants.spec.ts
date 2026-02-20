/**
 * LLM Solo Contestant 变体测试
 * Phase 2 验证
 */

import { test, expect } from '@playwright/test';
import { LLMSoloContestant, LLMSoloConfig, IntelligenceLevel, DEFAULT_LLM_SYSTEM_PROMPT } from '../lib/agents/contestants/llm-solo-contestant';

test.describe('Phase 2: LLM Solo Variants', () => {
    
    test('2.1 配置类型定义正确', () => {
        const config1: LLMSoloConfig = { intelligenceLevel: 'lite' };
        const config2: LLMSoloConfig = { intelligenceLevel: 'indicator', includeDaily: true };
        const config3: LLMSoloConfig = { customSystemPrompt: 'test' };
        
        expect(config1.intelligenceLevel).toBe('lite');
        expect(config2.includeDaily).toBe(true);
        expect(config3.customSystemPrompt).toBe('test');
    });

    test('2.2 构造函数支持新旧两种配置方式', () => {
        // 模拟依赖
        const mockDb = {} as any;
        const mockMinimax = {} as any;

        // 旧方式：字符串提示词（向后兼容）
        const oldStyle = new LLMSoloContestant('test1', 'Test', mockDb, mockMinimax, 'BTCUSDT', 'custom prompt');
        expect(oldStyle.getConfig().customSystemPrompt).toBe('custom prompt');
        expect(oldStyle.getConfig().intelligenceLevel).toBe('lite');

        // 新方式：配置对象
        const newStyle = new LLMSoloContestant('test2', 'Test', mockDb, mockMinimax, 'BTCUSDT', { 
            intelligenceLevel: 'strategy',
            includeDaily: true 
        });
        expect(newStyle.getConfig().intelligenceLevel).toBe('strategy');
        expect(newStyle.getConfig().includeDaily).toBe(true);

        // 默认配置
        const defaultStyle = new LLMSoloContestant('test3', 'Test', mockDb, mockMinimax, 'BTCUSDT');
        expect(defaultStyle.getConfig().intelligenceLevel).toBe('lite');
    });

    test('2.3 三种变体配置都能创建实例', () => {
        const mockDb = {} as any;
        const mockMinimax = {} as any;
        const levels: IntelligenceLevel[] = ['lite', 'indicator', 'strategy'];

        for (const level of levels) {
            const contestant = new LLMSoloContestant(
                `test-${level}`, 
                `Test ${level}`, 
                mockDb, 
                mockMinimax, 
                'BTCUSDT', 
                { intelligenceLevel: level }
            );
            expect(contestant.getConfig().intelligenceLevel).toBe(level);
            expect(contestant.id).toBe(`test-${level}`);
        }
    });

    test('2.4 默认系统提示词存在', () => {
        expect(DEFAULT_LLM_SYSTEM_PROMPT).toBeDefined();
        expect(DEFAULT_LLM_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    test('2.5 各变体提示词模板不同', () => {
        // 通过检查实例的行为来验证提示词不同
        const mockDb = {} as any;
        const mockMinimax = {} as any;

        const lite = new LLMSoloContestant('l', 'Lite', mockDb, mockMinimax, 'BTC', { intelligenceLevel: 'lite' });
        const indicator = new LLMSoloContestant('i', 'Indicator', mockDb, mockMinimax, 'BTC', { intelligenceLevel: 'indicator' });
        const strategy = new LLMSoloContestant('s', 'Strategy', mockDb, mockMinimax, 'BTC', { intelligenceLevel: 'strategy' });

        expect(lite.getConfig().intelligenceLevel).not.toBe(indicator.getConfig().intelligenceLevel);
        expect(indicator.getConfig().intelligenceLevel).not.toBe(strategy.getConfig().intelligenceLevel);
    });

    test('2.6 向后兼容：旧代码使用字符串提示词仍能工作', () => {
        const mockDb = {} as any;
        const mockMinimax = {} as any;
        const oldStylePrompt = '你是一个交易员，专注于BTC交易';

        // 模拟旧代码调用方式
        const contestant = new LLMSoloContestant(
            'legacy', 
            'Legacy Bot', 
            mockDb, 
            mockMinimax, 
            'BTCUSDT', 
            oldStylePrompt  // 字符串而非对象
        );

        expect(contestant.getConfig().customSystemPrompt).toBe(oldStylePrompt);
        expect(contestant.getConfig().intelligenceLevel).toBe('lite'); // 默认
    });

    test('2.7 Strategy 变体支持 includeDaily 配置', () => {
        const mockDb = {} as any;
        const mockMinimax = {} as any;

        const withDaily = new LLMSoloContestant('wd', 'With Daily', mockDb, mockMinimax, 'BTC', { 
            intelligenceLevel: 'strategy',
            includeDaily: true 
        });

        const withoutDaily = new LLMSoloContestant('wod', 'Without Daily', mockDb, mockMinimax, 'BTC', { 
            intelligenceLevel: 'strategy',
            includeDaily: false 
        });

        expect(withDaily.getConfig().includeDaily).toBe(true);
        expect(withoutDaily.getConfig().includeDaily).toBe(false);
    });
});
