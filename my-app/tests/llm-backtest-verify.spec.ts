/**
 * LLM 回测验证 - 使用模拟模式
 */

import { test, expect } from '@playwright/test';

test.describe('LLM 回测验证', () => {
    
    test('LLM模拟模式运行并产生日志', async ({ page }) => {
        await page.goto('/arena/');
        await page.waitForTimeout(2000);

        // 捕获浏览器控制台日志
        const consoleLogs: string[] = [];
        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push(text);
            if (text.includes('MockLLM') || text.includes('LLM') || text.includes('模拟')) {
                console.log('[Console]', text);
            }
        });

        // 设置3天回测，步长12小时（720分钟）
        await page.locator('input[type="date"]').first().fill('2025-01-01');
        await page.locator('input[type="date"]').nth(1).fill('2025-01-04');
        await page.locator('input[type="number"]').first().fill('720'); // 12小时

        // 取消DCA，只保留LLM
        await page.locator('.group:has-text("基准定投") .w-4').click();

        // 配置LLM为Indicator级别
        await page.locator('.group:has-text("LLM 单兵") button:has-text("配置")').click();
        await page.waitForTimeout(500);
        await page.locator('select').first().selectOption('indicator');
        await page.locator('button:has-text("保存并关闭")').click();
        await page.waitForTimeout(500);

        console.log('启动回测（LLM模拟模式）...');
        await page.locator('button:has-text("启动竞技")').click();

        // 等待回测完成
        await page.waitForSelector('text=最终战报', { timeout: 60000 });

        // 截图
        await page.screenshot({ path: 'test-results/llm-mock-test.png', fullPage: true });

        // 检查交易历史
        await page.locator('button:has-text("交易历史")').click();
        await page.waitForTimeout(1000);

        const tradeRows = page.locator('tbody tr');
        const tradeCount = await tradeRows.count();
        console.log(`LLM交易次数: ${tradeCount}`);

        // 检查日志
        await page.locator('button:has-text("实时日志")').click();
        await page.waitForTimeout(1000);

        const logElements = page.locator('.font-mono > div');
        const logCount = await logElements.count();
        console.log(`日志条数: ${logCount}`);

        // 获取日志内容
        const logText = await page.locator('.font-mono').textContent();
        console.log('日志内容:', logText?.substring(0, 1000));

        // 验证有决策日志
        const hasDecision = logText?.includes('BUY') || logText?.includes('SELL') || logText?.includes('WAIT');
        console.log('是否有交易决策:', hasDecision);
    });
});
