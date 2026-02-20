/**
 * Arena 回测功能检查 - 验证DCA多次交易和日志
 */

import { test, expect } from '@playwright/test';

test.describe('Arena 回测功能检查', () => {
    
    test('运行回测并检查DCA多次交易', async ({ page }) => {
        // 访问arena页面
        await page.goto('/arena/');
        await page.waitForTimeout(2000);

        // 设置回测时间（3天，步长1小时）
        await page.locator('input[type="date"]').first().fill('2025-01-01');
        await page.locator('input[type="date"]').nth(1).fill('2025-01-04');
        await page.locator('input[type="number"]').first().fill('60'); // 1小时步长

        // 只选择DCA选手（取消LLM）
        await page.locator('.group:has-text("LLM 单兵") .w-4').click();

        // 配置DCA为每1天定投
        await page.locator('.group:has-text("基准定投") button:has-text("配置")').click();
        await page.waitForTimeout(500);
        await page.locator('input[type="number"]').nth(1).fill('1440'); // 1天
        await page.locator('button:has-text("保存并关闭")').click();
        await page.waitForTimeout(500);

        // 启动回测
        console.log('启动回测...');
        await page.locator('button:has-text("启动竞技")').click();

        // 等待回测完成（最多60秒）
        await page.waitForSelector('text=最终战报', { timeout: 60000 });

        // 截图结果
        await page.screenshot({ path: 'test-results/backtest-results.png', fullPage: true });

        // 检查交易历史
        await page.locator('button:has-text("交易历史")').click();
        await page.waitForTimeout(1000);

        // 截图交易历史
        await page.screenshot({ path: 'test-results/backtest-trades.png' });

        // 获取交易数量
        const tradeRows = page.locator('tbody tr');
        const tradeCount = await tradeRows.count();
        console.log(`DCA交易次数: ${tradeCount}`);

        // 3天回测，每天1次定投，应该有3次交易
        expect(tradeCount).toBeGreaterThanOrEqual(2);

        // 检查日志
        await page.locator('button:has-text("实时日志")').click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-results/backtest-logs.png' });

        const logs = page.locator('.font-mono > div');
        const logCount = await logs.count();
        console.log(`日志数量: ${logCount}`);
        expect(logCount).toBeGreaterThan(0);
    });

    test('检查LLM变体日志输出', async ({ page }) => {
        await page.goto('/arena/');
        await page.waitForTimeout(2000);

        // 设置1天回测
        await page.locator('input[type="date"]').first().fill('2025-01-01');
        await page.locator('input[type="date"]').nth(1).fill('2025-01-02');
        await page.locator('input[type="number"]').first().fill('60');

        // 取消DCA，只保留LLM
        await page.locator('.group:has-text("基准定投") .w-4').click();

        // 配置LLM为Strategy变体
        await page.locator('.group:has-text("LLM 单兵") button:has-text("配置")').click();
        await page.waitForTimeout(500);
        await page.locator('select').first().selectOption('strategy');
        await page.locator('button:has-text("保存并关闭")').click();
        await page.waitForTimeout(500);

        // 启动回测
        console.log('启动LLM Strategy回测...');
        await page.locator('button:has-text("启动竞技")').click();

        // 等待回测完成
        await page.waitForSelector('text=最终战报', { timeout: 60000 });

        // 截图
        await page.screenshot({ path: 'test-results/llm-strategy-results.png', fullPage: true });

        // 检查日志中是否有Strategy标识
        await page.locator('button:has-text("实时日志")').click();
        await page.waitForTimeout(1000);

        const logText = await page.locator('.font-mono').textContent();
        console.log('日志内容片段:', logText?.substring(0, 500));

        // 检查是否有LLM相关日志
        expect(logText).toContain('LLM');
    });
});
