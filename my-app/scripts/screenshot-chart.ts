import { chromium } from '@playwright/test';

async function screenshot() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  try {
    // 访问页面
    await page.goto('http://localhost:3000/chart/', { timeout: 30000 });
    
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    
    // 点击"加载数据"按钮
    await page.click('button:has-text("加载数据")');
    
    // 等待数据加载和图表渲染
    await page.waitForTimeout(5000);
    
    // 截图
    await page.screenshot({ 
      path: 'screenshots/chart-with-klines.png',
      fullPage: false 
    });
    
    console.log('✅ Screenshot saved to screenshots/chart-with-klines.png');
  } catch (e) {
    console.error('❌ Error:', e);
    await page.screenshot({ path: 'screenshots/chart-error.png' });
  } finally {
    await browser.close();
  }
}

screenshot();
