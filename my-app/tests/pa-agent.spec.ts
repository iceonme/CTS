import { test, expect } from '@playwright/test';

test.describe('PA Agent (LLM + Skills) 测试', () => {
  
  test('PA 应该通过 LLM 理解并调用 Skill', async ({ request }) => {
    // 测试 PA 的 chat 接口
    const response = await request.post('/api/pa/chat', {
      data: {
        message: '分析 BTC',
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    console.log('PA 回复:', result.reply);
    console.log('调用的 Skills:', result.actions);
    
    // 验证 PA 调用了 analysis:market Skill
    expect(result.reply).toContain('BTC');
    expect(result.actions).toBeDefined();
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.actions[0].skill).toBe('analysis:market');
    expect(result.actions[0].params.symbol).toBe('BTC');
  });

  test('PA 应该能查看持仓', async ({ request }) => {
    const response = await request.post('/api/pa/chat', {
      data: {
        message: '我的资产',
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    console.log('PA 回复:', result.reply);
    
    expect(result.reply).toContain('资产');
    expect(result.actions).toBeDefined();
    expect(result.actions[0].skill).toBe('portfolio:get');
  });

  test('PA 应该通过 LLM 决策并执行交易', async ({ request }) => {
    // 先买入一些持仓
    await request.post('/api/pa/chat', {
      data: { message: '买入 1000 USDT 的 BTC' },
    });

    // 测试 PA 交易
    const response = await request.post('/api/pa/chat', {
      data: {
        message: '买入 500 USDT 的 BTC',
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    console.log('PA 回复:', result.reply);
    console.log('调用的 Skills:', result.actions?.map((a: any) => a.skill));
    
    // PA 应该先分析，再交易
    expect(result.actions?.length).toBeGreaterThanOrEqual(1);
    expect(result.actions?.some((a: any) => a.skill === 'simulation:trade')).toBe(true);
    
    // 验证交易结果
    const tradeAction = result.actions?.find((a: any) => a.skill === 'simulation:trade');
    expect(tradeAction.result).toBeDefined();
    expect(tradeAction.result.symbol).toBe('BTC');
    expect(tradeAction.result.side).toBe('buy');
  });

  test('PA 应该返回帮助信息', async ({ request }) => {
    const response = await request.post('/api/pa/chat', {
      data: {
        message: '你好',
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    console.log('PA 回复:', result.reply);
    
    // 没有调用 Skills，只是对话
    expect(result.actions).toBeUndefined();
    expect(result.reply).toContain('市场分析');
    expect(result.reply).toContain('持仓');
  });
});
