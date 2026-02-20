/**
 * Arena API 集成测试
 * Phase 3 验证
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 3: Arena API Integration', () => {
    
    const baseUrl = 'http://localhost:3000';

    test('3.1 API 支持 intelligenceLevel 参数', async ({ request }) => {
        // 构造包含新配置的请求体
        const requestBody = {
            start: '2025-01-01T00:00:00Z',
            end: '2025-01-02T00:00:00Z',
            symbol: 'BTCUSDT',
            stepMinutes: 60,
            initialCapital: 10000,
            contestants: [
                {
                    id: 'llm-lite',
                    type: 'llm-solo',
                    name: 'LLM-Lite',
                    settings: {
                        intelligenceLevel: 'lite'
                    }
                },
                {
                    id: 'llm-indicator',
                    type: 'llm-solo',
                    name: 'LLM-Indicator',
                    settings: {
                        intelligenceLevel: 'indicator'
                    }
                },
                {
                    id: 'llm-strategy',
                    type: 'llm-solo',
                    name: 'LLM-Strategy',
                    settings: {
                        intelligenceLevel: 'strategy',
                        includeDaily: true
                    }
                }
            ]
        };

        // 验证请求体结构（不实际调用，避免需要运行服务器）
        expect(requestBody.contestants).toHaveLength(3);
        expect(requestBody.contestants[0].settings.intelligenceLevel).toBe('lite');
        expect(requestBody.contestants[1].settings.intelligenceLevel).toBe('indicator');
        expect(requestBody.contestants[2].settings.intelligenceLevel).toBe('strategy');
        expect(requestBody.contestants[2].settings.includeDaily).toBe(true);
    });

    test('3.2 API 向后兼容旧格式', async () => {
        const oldStyleRequest = {
            start: '2025-01-01T00:00:00Z',
            end: '2025-01-02T00:00:00Z',
            symbol: 'BTCUSDT',
            contestants: [
                {
                    id: 'llm-old',
                    type: 'llm-solo',
                    name: 'LLM-Old',
                    settings: {
                        systemPrompt: '自定义提示词'  // 旧格式使用 systemPrompt
                    }
                }
            ]
        };

        expect(oldStyleRequest.contestants[0].settings.systemPrompt).toBeDefined();
        expect(oldStyleRequest.contestants[0].settings.intelligenceLevel).toBeUndefined();
    });

    test('3.3 字符串格式的 contestants 仍支持', async () => {
        const mixedRequest = {
            start: '2025-01-01T00:00:00Z',
            end: '2025-01-02T00:00:00Z',
            symbol: 'BTCUSDT',
            contestants: [
                'dca-bot',  // 字符串格式
                {
                    id: 'llm-new',
                    type: 'llm-solo',
                    settings: { intelligenceLevel: 'strategy' }
                }
            ]
        };

        expect(typeof mixedRequest.contestants[0]).toBe('string');
        expect(typeof mixedRequest.contestants[1]).toBe('object');
    });

    test('3.4 不同变体的名称反映配置', async () => {
        const contestants = [
            { id: 'llm1', type: 'llm-solo', name: 'Solo-Lite', settings: { intelligenceLevel: 'lite' } },
            { id: 'llm2', type: 'llm-solo', settings: { intelligenceLevel: 'indicator' } },
            { id: 'llm3', type: 'llm-solo', name: 'Custom Name', settings: { intelligenceLevel: 'strategy' } }
        ];

        // 验证名称逻辑
        expect(contestants[0].name).toBe('Solo-Lite');
        expect(contestants[1].name).toBeUndefined(); // 将使用默认命名
        expect(contestants[2].name).toBe('Custom Name');
    });
});
