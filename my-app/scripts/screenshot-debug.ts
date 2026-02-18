import { chromium } from '@playwright/test';

async function screenshot() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  // 监听控制台消息
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[${type}] ${text}`);
  });
  
  page.on('pageerror', error => {
    console.log(`[Page Error] ${error.message}`);
  });
  
  try {
    await page.goto('http://localhost:3000/chart/', { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    
    console.log('Clicking load data button...');
    await page.click('button:has-text("加载数据")');
    
    await page.waitForTimeout(5000);
    
    await page.screenshot({ path: 'screenshots/chart-debug.png' });
    console.log('Screenshot saved');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await browser.close();
  }
}

screenshot();
