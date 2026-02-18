import { chromium } from '@playwright/test';

async function screenshot() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  try {
    await page.goto('http://localhost:3000/chart/', { timeout: 30000 });
    await page.waitForTimeout(5000);
    
    await page.screenshot({ path: 'screenshots/chart-final-1m.png' });
    console.log('1m screenshot saved');
    
    // 切换到1小时
    await page.click('button:has-text("1时")');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/chart-final-1h.png' });
    console.log('1h screenshot saved');
    
    // 切换到日线
    await page.click('button:has-text("1日")');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/chart-final-1d.png' });
    console.log('1d screenshot saved');
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await browser.close();
  }
}

screenshot();
