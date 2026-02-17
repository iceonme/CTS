import { test, expect } from '@playwright/test';

test.describe('模拟交易 Skill 测试', () => {
  
  test('CFO 可以执行简单的买入交易', async ({ request }) => {
    // 调用一个简单的 API 测试交易
    const response = await request.post('/api/test/trade', {
      data: {
        symbol: 'BTC',
        side: 'buy',
        amount: 500,
        reason: '测试买入',
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    // 打印结果用于调试
    console.log('买入结果:', JSON.stringify(result, null, 2));
    
    expect(result.success).toBe(true);
    expect(result.trade).toBeDefined();
    expect(result.trade.symbol).toBe('BTC');
    expect(result.trade.side).toBe('buy');
    expect(result.trade.quantity).toBeGreaterThan(0);
    expect(result.portfolio).toBeDefined();
    
    console.log('✅ 买入交易成功:');
    console.log(`   数量: ${result.trade.quantity} BTC`);
    console.log(`   价格: $${result.trade.price}`);
    console.log(`   总额: $${result.trade.total}`);
    console.log(`   总资产: $${result.portfolio.totalEquity}`);
  });

  test('CFO 可以执行简单的卖出交易', async ({ request }) => {
    // 先买入一些
    await request.post('/api/test/trade', {
      data: {
        symbol: 'DOGE',
        side: 'buy',
        amount: 100,
      },
    });

    // 然后卖出
    const response = await request.post('/api/test/trade', {
      data: {
        symbol: 'DOGE',
        side: 'sell',
        quantity: 50,
        reason: '测试卖出',
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    expect(result.success).toBe(true);
    expect(result.trade.side).toBe('sell');
    
    console.log('✅ 卖出交易成功');
  });

  test('交易失败时返回清晰错误', async ({ request }) => {
    // 尝试买入不提供 amount
    const response = await request.post('/api/test/trade', {
      data: {
        symbol: 'BTC',
        side: 'buy',
        // 缺少 amount
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('amount');
    
    console.log('✅ 错误处理正常:', result.error);
  });
});
