/**
 * LLM Solo 调试测试
 */

import { test, expect } from '@playwright/test';

test.describe('LLM Solo 调试', () => {
    
    test('检查环境变量和LLM初始化', async ({ page }) => {
        // 访问arena页面
        await page.goto('/arena/');
        await page.waitForTimeout(2000);

        // 捕获控制台日志
        const consoleLogs: string[] = [];
        page.on('console', msg => {
            consoleLogs.push(msg.text());
            console.log('[Browser Console]', msg.text());
        });

        // 设置回测参数
        await page.locator('input[type="date"]').first().fill('2025-01-01');
        await page.locator('input[type="date"]').nth(1).fill('2025-01-02');
        await page.locator('input[type="number"]').first().fill('720'); // 12小时步长

        // 取消DCA，只保留LLM
        await page.locator('.group:has-text("基准定投") .w-4').click();

        // 配置LLM为Indicator级别
        await page.locator('.group:has-text("LLM 单兵") button:has-text("配置")').click();
        await page.waitForTimeout(500);
        await page.locator('select').first().selectOption('indicator');
        await page.locator('button:has-text("保存并关闭")').click();
        await page.waitForTimeout(500);

        // 启动回测
        console.log('启动回测...');
        await page.locator('button:has-text("启动竞技")').click();

        // 等待一段时间收集日志
        await page.waitForTimeout(15000);

        // 截图
        await page.screenshot({ path: 'test-results/llm-debug.png', fullPage: true });

        // 检查服务器日志（通过浏览器console代理）
        console.log('=== 收集到的日志 ===');
        consoleLogs.forEach((log, i) => {
            if (log.includes('LLM') || log.includes('Backtest API') || log.includes('skipping')) {
                console.log(`${i}: ${log}`);
            }
        });

        // 检查是否有API Key缺失的警告
        const hasApiKeyWarning = consoleLogs.some(log => 
            log.includes('MiniMax API Key missing') || 
            log.includes('skipping LLM Solo')
        );

        if (hasApiKeyWarning) {
            console.log('⚠️ 检测到MiniMax API Key缺失，LLM Solo被跳过');
        }

        // 检查页面内容
        const pageText = await page.locator('body').textContent();
        
        // 如果LLM正常工作，应该能看到日志或交易
        const hasLogs = await page.locator('.font-mono > div').count() > 0;
        console.log('是否有日志:', hasLogs);
    });

    test('验证API配置传递', async () => {
        // 验证API路由配置
        const routeContent = await import('../app/api/backtest/run/route.ts');
        console.log('API Route loaded');
        
        // 检查环境变量
        const envVars = {
            MINIMAX_API_KEY: process.env.MINIMAX_API_KEY ? '已设置' : '未设置',
            MINIMAX_GROUP_ID: process.env.MINIMAX_GROUP_ID ? '已设置' : '未设置'
        };
        console.log('环境变量状态:', envVars);
    });
});
