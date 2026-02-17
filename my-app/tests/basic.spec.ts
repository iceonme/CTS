import { test, expect } from '@playwright/test';

// 测试首页
 test('首页加载正常', async ({ page }) => {
  await page.goto('/');
  
  // 等待页面加载
  await page.waitForLoadState('networkidle');
  
  // 检查标题
  const title = await page.title();
  console.log('页面标题:', title);
  expect(title).toContain('CryptoPulse');
  
  // 检查导航栏
  const nav = await page.locator('nav').first().isVisible();
  expect(nav).toBe(true);
  
  // 检查关键导航链接
  const links = ['资产', '情报流', '作战室', 'MAS成员', '设置'];
  for (const link of links) {
    const locator = page.getByText(link, { exact: false });
    const count = await locator.count();
    console.log(`导航链接 "${link}": ${count > 0 ? '✓' : '✗'}`);
  }
  
  // 截图保存
  await page.screenshot({ path: 'screenshots/home.png', fullPage: true });
  console.log('首页截图已保存');
});

// 测试 Portfolio 页面
test('Portfolio 页面加载正常', async ({ page }) => {
  await page.goto('/portfolio');
  await page.waitForLoadState('networkidle');
  
  // 检查页面标题
  const header = await page.locator('h1').textContent();
  console.log('Portfolio 标题:', header);
  expect(header).toContain('资产管理');
  
  // 检查 Tab 导航
  const tabs = ['概览', '持仓', '资产配置', '交易记录'];
  for (const tab of tabs) {
    const visible = await page.getByText(tab).isVisible().catch(() => false);
    console.log(`Tab "${tab}": ${visible ? '✓' : '✗'}`);
  }
  
  await page.screenshot({ path: 'screenshots/portfolio.png', fullPage: true });
  console.log('Portfolio 截图已保存');
});

// 测试 WarRoom 页面
test('WarRoom 页面加载正常', async ({ page }) => {
  await page.goto('/warroom');
  await page.waitForLoadState('networkidle');
  
  // 检查标题
  const header = await page.locator('h1').textContent();
  console.log('WarRoom 标题:', header);
  expect(header).toContain('WarRoom');
  
  // 检查任务列表
  const tasks = await page.locator('[class*="bg-gray-900 rounded-lg"]').count();
  console.log(`找到 ${tasks} 个任务卡片`);
  
  // 截图
  await page.screenshot({ path: 'screenshots/warroom.png', fullPage: true });
  console.log('WarRoom 截图已保存');
  
  // 测试展开任务详情
  const firstTask = page.locator('[class*="bg-gray-900 rounded-lg"]').first();
  if (await firstTask.isVisible()) {
    await firstTask.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/warroom-expanded.png', fullPage: true });
    console.log('WarRoom 展开详情截图已保存');
  }
});

// 测试 Feed 页面
test('Feed 页面加载正常', async ({ page }) => {
  await page.goto('/feed');
  await page.waitForLoadState('networkidle');
  
  const header = await page.locator('h1').textContent();
  console.log('Feed 标题:', header);
  expect(header).toContain('Feed');
  
  // 检查过滤器
  const filterVisible = await page.getByText('标的:').isVisible().catch(() => false);
  console.log('过滤器:', filterVisible ? '✓' : '✗');
  
  await page.screenshot({ path: 'screenshots/feed.png', fullPage: true });
  console.log('Feed 截图已保存');
});

// 测试 Agents 页面
test('Agents 页面加载正常', async ({ page }) => {
  await page.goto('/agents');
  await page.waitForLoadState('networkidle');
  
  const header = await page.locator('h1').textContent();
  console.log('Agents 标题:', header);
  expect(header).toContain('MAS');
  
  // 检查 Agent 卡片
  const agents = ['投资助手', '技术分析员', 'Polymarket专员'];
  for (const agent of agents) {
    const visible = await page.getByText(agent).isVisible().catch(() => false);
    console.log(`Agent "${agent}": ${visible ? '✓' : '✗'}`);
  }
  
  await page.screenshot({ path: 'screenshots/agents.png', fullPage: true });
  console.log('Agents 截图已保存');
});

// 测试 Settings 页面
test('Settings 页面加载正常', async ({ page }) => {
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  
  // 检查 Tab
  const tabs = ['身份设定', 'Skills', '行为偏好', '版本历史'];
  for (const tab of tabs) {
    const visible = await page.getByText(tab).isVisible().catch(() => false);
    console.log(`Settings Tab "${tab}": ${visible ? '✓' : '✗'}`);
  }
  
  await page.screenshot({ path: 'screenshots/settings.png', fullPage: true });
  console.log('Settings 截图已保存');
});

// 响应式测试
test('响应式布局测试', async ({ page }) => {
  // 桌面端
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/responsive-desktop.png' });
  console.log('桌面端截图已保存');
  
  // 平板端
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/responsive-tablet.png' });
  console.log('平板端截图已保存');
  
  // 手机端
  await page.setViewportSize({ width: 375, height: 667 });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/responsive-mobile.png' });
  console.log('手机端截图已保存');
});
