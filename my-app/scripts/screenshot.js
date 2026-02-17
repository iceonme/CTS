const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  const pages = [
    { url: 'http://localhost:3000', name: 'home' },
    { url: 'http://localhost:3000/feed', name: 'feed' },
    { url: 'http://localhost:3000/warroom', name: 'warroom' }
  ];
  
  for (const p of pages) {
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: `/home/iceonme/CTS/my-app/screenshots/${p.name}.png`,
        fullPage: true 
      });
      console.log(`✅ ${p.name} 截图完成`);
    } catch (e) {
      console.error(`❌ ${p.name} 失败: ${e.message}`);
    }
  }
  
  await browser.close();
  console.log('所有截图完成');
})();
