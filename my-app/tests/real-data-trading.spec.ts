import { test, expect } from '@playwright/test';

test.describe('真实数据交易测试页面', () => {
  test('测试页面加载正常', async ({ page }) => {
    await page.goto('/test');
    
    // 检查页面标题
    await expect(page).toHaveTitle(/CryptoPulse AI/);
    
    // 检查测试按钮
    const startButton = page.locator('button:has-text("开始测试")');
    await expect(startButton).toBeVisible();
    
    console.log('✅ 测试页面加载成功');
  });

  test('执行真实数据交易测试', async ({ page }) => {
    await page.goto('/test');
    
    // 点击开始测试按钮
    const startButton = page.locator('button:has-text("开始测试")');
    await startButton.click();
    
    // 等待测试完成（最多 30 秒）
    await page.waitForSelector('text=所有测试通过', { timeout: 30000 });
    
    // 检查日志内容
    const logContainer = page.locator('.font-mono');
    const logText = await logContainer.textContent();
    
    // 验证关键步骤出现在日志中
    expect(logText).toContain('从 CoinGecko 获取真实价格数据');
    expect(logText).toContain('成功获取真实数据');
    expect(logText).toContain('BTC');
    expect(logText).toContain('DOGE');
    expect(logText).toContain('初始化模拟投资组合');
    expect(logText).toContain('执行模拟交易');
    expect(logText).toContain('买入成功');
    expect(logText).toContain('当前投资组合状态');
    expect(logText).toContain('所有测试通过');
    
    console.log('✅ 真实数据交易测试通过');
    
    // 截图保存
    await page.screenshot({ path: 'test-results/real-data-trading.png', fullPage: true });
  });

  test('验证实时价格显示', async ({ page }) => {
    await page.goto('/test');
    
    // 点击开始测试
    await page.click('button:has-text("开始测试")');
    
    // 等待价格数据加载
    await page.waitForSelector('text=实时价格 (CoinGecko)', { timeout: 30000 });
    
    // 检查价格卡片显示
    const priceSection = page.locator('text=实时价格 (CoinGecko)').first();
    await expect(priceSection).toBeVisible();
    
    // 检查 BTC 和 DOGE 价格显示
    const btcPrice = page.locator('text=BTC').first();
    const dogePrice = page.locator('text=DOGE').first();
    
    await expect(btcPrice).toBeVisible();
    await expect(dogePrice).toBeVisible();
    
    console.log('✅ 实时价格显示正常');
  });

  test('验证 Portfolio 状态更新', async ({ page }) => {
    await page.goto('/test');
    
    // 执行测试
    await page.click('button:has-text("开始测试")');
    await page.waitForSelector('text=所有测试通过', { timeout: 30000 });
    
    // 检查 Portfolio 卡片
    const portfolioSection = page.locator('text=Portfolio').first();
    await expect(portfolioSection).toBeVisible();
    
    // 验证关键数据显示
    await expect(page.locator('text=总资产:')).toBeVisible();
    await expect(page.locator('text=可用余额:')).toBeVisible();
    await expect(page.locator('text=未实现盈亏:')).toBeVisible();
    
    // 验证持仓显示
    await expect(page.locator('text=持仓')).toBeVisible();
    
    console.log('✅ Portfolio 状态更新正常');
    
    // 截图保存 Portfolio 状态
    await page.screenshot({ path: 'test-results/portfolio-state.png', fullPage: false });
  });

  test('测试页面响应式布局', async ({ page }) => {
    // 桌面端
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/test');
    await expect(page.locator('button:has-text("开始测试")')).toBeVisible();
    
    // 平板端
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await expect(page.locator('button:has-text("开始测试")')).toBeVisible();
    
    // 手机端
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await expect(page.locator('button:has-text("开始测试")')).toBeVisible();
    
    console.log('✅ 响应式布局测试通过');
  });
});
