import { chromium } from '@playwright/test';

async function screenshot() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  try {
    await page.goto('http://localhost:3000/chart/', { timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // 点击刷新按钮
    await page.click('button:has-text("刷新")');
    await page.waitForTimeout(5000);
    
    // 截图
    await page.screenshot({ path: 'screenshots/chart-v2-with-data.png' });
    console.log('Screenshot saved');
    
    // 测试切换周期到 1小时
    await page.click('button:has-text("1时")');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/chart-v2-1h.png' });
    console.log('1H screenshot saved');
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await browser.close();
  }
}

screenshot();
