import { test, expect } from '@playwright/test';

test('chart page loads and displays klines', async ({ page }) => {
  // 访问 chart 页面
  await page.goto('http://localhost:3000/chart');
  
  // 等待页面加载
  await page.waitForLoadState('networkidle');
  
  // 等待标题
  await expect(page.getByText('TradeMind 市场数据')).toBeVisible();
  
  // 等待 K 线图容器
  await page.waitForSelector('[class*="tv-lightweight-charts"] canvas', { timeout: 10000 });
  
  // 等待数据加载
  await page.waitForTimeout(3000);
  
  // 截图保存
  await page.screenshot({ 
    path: 'screenshots/chart-page.png',
    fullPage: false
  });
  
  console.log('Chart page screenshot saved to screenshots/chart-page.png');
});
