/**
 * Arena UI 视觉检查
 */

import { test, expect } from '@playwright/test';

test.describe('Arena UI 视觉检查', () => {
    
    test('截图检查Arena页面', async ({ page }) => {
        // 启动服务器（使用3000端口）
        const response = await page.goto('/arena/', { 
            timeout: 30000,
            waitUntil: 'networkidle'
        });
        
        console.log('Response status:', response?.status());
        console.log('Response URL:', page.url());
        
        // 等待页面加载
        await page.waitForTimeout(3000);
        
        // 截图整个页面
        await page.screenshot({ path: 'test-results/arena-full.png', fullPage: true });
        
        // 检查是否有404
        const bodyText = await page.locator('body').textContent();
        console.log('Body contains 404:', bodyText?.includes('404'));
        console.log('Body contains This page could not be found:', bodyText?.includes('This page could not be found'));
        
        // 检查关键元素
        const title = await page.locator('h1').textContent().catch(() => 'No h1 found');
        console.log('页面标题:', title);
        
        // 检查参赛选手列表
        const contestants = await page.locator('.group').count();
        console.log('选手卡片数量:', contestants);
    });

    test('检查DCA配置弹窗', async ({ page }) => {
        await page.goto('/arena/', { timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // 点击DCA配置按钮
        const dcaCard = page.locator('.group:has-text("基准定投")');
        await dcaCard.locator('button:has-text("配置")').click();
        
        await page.waitForTimeout(1000);
        
        // 截图配置弹窗
        await page.screenshot({ path: 'test-results/arena-dca-config.png' });
        
        // 检查弹窗内容
        const modalText = await page.locator('.fixed').textContent();
        console.log('DCA配置弹窗内容:', modalText?.substring(0, 200));
    });

    test('检查LLM配置弹窗', async ({ page }) => {
        await page.goto('/arena/', { timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // 点击LLM配置按钮
        const llmCard = page.locator('.group:has-text("LLM 单兵")');
        await llmCard.locator('button:has-text("配置")').click();
        
        await page.waitForTimeout(1000);
        
        // 截图配置弹窗
        await page.screenshot({ path: 'test-results/arena-llm-config.png' });
        
        // 检查是否有情报等级选择
        const hasLevel = await page.locator('text=情报等级').count();
        console.log('情报等级元素存在:', hasLevel > 0);
        
        const modalText = await page.locator('.fixed').textContent();
        console.log('LLM配置弹窗内容:', modalText?.substring(0, 300));
    });

    test('检查新建选手弹窗', async ({ page }) => {
        await page.goto('/arena/', { timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // 点击新建按钮
        await page.locator('button:has-text("新建")').click();
        
        await page.waitForTimeout(1000);
        
        // 截图
        await page.screenshot({ path: 'test-results/arena-new-contestant.png' });
        
        const modalText = await page.locator('.fixed').textContent();
        console.log('新建选手弹窗内容:', modalText);
    });
});
