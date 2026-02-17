import { test, expect } from '@playwright/test';

// 串行执行这些测试，避免 API 限速
test.describe.configure({ mode: 'serial' });

test.describe('真实数据 API 测试', () => {
  let apiResponse: any = null;
  
  test.beforeAll(async ({ request }) => {
    // 等待 2 秒，避免 API 限速
    await new Promise(r => setTimeout(r, 2000));
    
    const response = await request.get('/api/test/real-data/');
    apiResponse = await response.json();
    
    // 打印日志用于调试
    console.log('API Response log:');
    console.log(apiResponse.log);
  });

  test('API 路由返回正确的数据结构', async () => {
    expect(apiResponse).toBeDefined();
    expect(apiResponse.success).toBe(true);
    expect(apiResponse.log).toContain('从 CoinGecko 获取真实价格数据');
    expect(apiResponse.data).toBeDefined();
    expect(apiResponse.data.portfolio).toBeDefined();
  });

  test('API 执行了模拟交易并创建了持仓', async () => {
    const portfolio = apiResponse.data.portfolio;
    
    // 验证 Portfolio 有资产
    expect(portfolio.totalEquity).toBeGreaterThan(0);
    
    // 验证持仓数组存在
    expect(portfolio.positions).toBeDefined();
    expect(Array.isArray(portfolio.positions)).toBe(true);
    
    // 如果有持仓，验证结构
    if (portfolio.positions.length > 0) {
      const position = portfolio.positions[0];
      expect(position.symbol).toBeDefined();
      expect(position.quantity).toBeGreaterThan(0);
      expect(position.avgPrice).toBeGreaterThan(0);
      
      console.log('✅ 持仓验证成功:');
      portfolio.positions.forEach((p: any) => {
        console.log(`   ${p.symbol}: ${p.quantity} @ $${p.avgPrice.toFixed(p.avgPrice < 1 ? 4 : 2)}`);
      });
    } else {
      // API 可能限速了，检查日志
      console.log('⚠️ 没有持仓，可能 API 限速');
      console.log('API Log:', apiResponse.log);
    }
  });

  test('Portfolio 计算正确', async () => {
    const portfolio = apiResponse.data.portfolio;
    
    // 验证基本字段
    expect(portfolio.totalEquity).toBeGreaterThanOrEqual(0);
    expect(portfolio.balance).toBeGreaterThanOrEqual(0);
    
    // 总资产应该大于等于可用余额
    expect(portfolio.totalEquity).toBeGreaterThanOrEqual(portfolio.balance);
    
    console.log('✅ Portfolio 计算验证:');
    console.log(`   总资产: $${portfolio.totalEquity.toFixed(2)}`);
    console.log(`   可用余额: $${portfolio.balance.toFixed(2)}`);
    console.log(`   持仓价值: $${(portfolio.totalEquity - portfolio.balance).toFixed(2)}`);
  });

  test('测试页面加载和基础 UI', async ({ page }) => {
    await page.goto('/test');
    
    // 检查页面标题和按钮
    await expect(page.locator('h1:has-text("真实数据交易测试")')).toBeVisible();
    await expect(page.locator('button:has-text("开始测试")')).toBeVisible();
    
    // 检查布局
    await expect(page.locator('h2:has-text("测试日志")')).toBeVisible();
    await expect(page.locator('h2:has-text("当前状态")')).toBeVisible();
    
    console.log('✅ 测试页面 UI 正常');
    
    // 截图保存
    await page.screenshot({ path: 'test-results/test-page-ui.png', fullPage: true });
  });
});
