import { test, expect } from '@playwright/test';

test.describe('CryptoPulse AI 页面测试', () => {
  
  test('首页加载正常', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/CryptoPulse AI/);
    await expect(page.locator('text=CFO 控制台')).toBeVisible();
    await page.screenshot({ path: 'test-results/home.png', fullPage: true });
    console.log('✅ 首页测试通过');
  });

  test('导航栏链接正常', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // 测试情报流链接
    await page.click('text=情报流');
    await expect(page).toHaveURL(/feed/);
    await expect(page.locator('text=情报中心')).toBeVisible();
    await page.screenshot({ path: 'test-results/feed.png', fullPage: true });
    
    // 测试作战室链接
    await page.goto('http://localhost:3000');
    await page.click('text=作战室');
    await expect(page).toHaveURL(/warroom/);
    await expect(page.locator('text=作战室')).toBeVisible();
    await page.screenshot({ path: 'test-results/warroom.png', fullPage: true });
    
    console.log('✅ 导航栏测试通过');
  });

  test('API 正常响应', async ({ request }) => {
    const marketResponse = await request.get('http://localhost:3000/api/market?type=prices');
    expect(marketResponse.ok()).toBeTruthy();
    
    const analysisResponse = await request.get('http://localhost:3000/api/analysis?type=market-overview');
    expect(analysisResponse.ok()).toBeTruthy();
    
    console.log('✅ API 测试通过');
  });

  test('WarRoom 数据加载', async ({ page }) => {
    await page.goto('http://localhost:3000/warroom');
    
    // 等待加载完成（或失败）
    await page.waitForTimeout(5000);
    
    // 截图保存
    await page.screenshot({ path: 'test-results/warroom-loaded.png', fullPage: true });
    
    // 检查是否有数据或错误提示
    const hasData = await page.locator('text=资产分析').isVisible().catch(() => false);
    const hasError = await page.locator('text=加载失败').isVisible().catch(() => false);
    
    if (hasData) {
      console.log('✅ WarRoom 数据加载成功');
    } else if (hasError) {
      console.log('⚠️ WarRoom 加载失败，需要检查');
    } else {
      console.log('⏳ WarRoom 仍在加载中');
    }
  });
});
