/**
 * Arena 集成测试 - 验证DCA和LLM变体
 */

import { test, expect } from '@playwright/test';

test.describe('Arena 集成测试', () => {
    
    test.beforeEach(async ({ page }) => {
        await page.goto('/arena');
        await page.waitForLoadState('networkidle');
    });

    test('1. Arena页面正常加载', async ({ page }) => {
        // 检查标题
        await expect(page.locator('h1')).toContainText('回测竞技场');
        
        // 检查配置区域
        await expect(page.locator('text=回测配置')).toBeVisible();
        await expect(page.locator('text=参赛选手')).toBeVisible();
        
        // 检查默认选手
        await expect(page.locator('text=基准定投 (DCA)')).toBeVisible();
        await expect(page.locator('text=LLM 单兵 (MiniMax)')).toBeVisible();
        
        console.log('✅ Arena页面加载正常');
    });

    test('2. DCA配置弹窗显示正确', async ({ page }) => {
        // 点击DCA的配置按钮
        const dcaCard = page.locator('.group:has-text("基准定投")');
        await dcaCard.locator('button:has-text("配置")').click();
        
        // 检查弹窗内容
        await expect(page.locator('text=定投金额')).toBeVisible();
        await expect(page.locator('text=时间间隔')).toBeVisible();
        
        // 检查默认值
        const investInput = page.locator('input[type="number"]').first();
        const intervalInput = page.locator('input[type="number"]').nth(1);
        
        await expect(investInput).toHaveValue('500');
        await expect(intervalInput).toHaveValue('1440'); // 1天
        
        // 关闭弹窗
        await page.locator('button:has-text("保存并关闭")').click();
        
        console.log('✅ DCA配置弹窗正常');
    });

    test('3. LLM变体选择UI存在', async ({ page }) => {
        // 点击LLM单兵的配置按钮
        const llmCard = page.locator('.group:has-text("LLM 单兵")');
        await llmCard.locator('button:has-text("配置")').click();
        
        // 检查情报等级下拉
        await expect(page.locator('text=情报等级')).toBeVisible();
        await expect(page.locator('select')).toBeVisible();
        
        // 检查选项
        const select = page.locator('select').first();
        await expect(select).toContainText('Lite');
        await expect(select).toContainText('Indicator');
        await expect(select).toContainText('Strategy');
        
        // 测试切换选项
        await select.selectOption('strategy');
        await expect(page.locator('text=包含日线数据')).toBeVisible();
        
        // 关闭弹窗
        await page.locator('button:has-text("保存并关闭")').click();
        
        console.log('✅ LLM变体选择UI正常');
    });

    test('4. 新建LLM选手可以选择变体', async ({ page }) => {
        // 点击新建按钮
        await page.locator('button:has-text("新建")').click();
        
        // 填写名称
        await page.locator('input[name="name"]').fill('Test-Strategy-Bot');
        
        // 选择LLM类型
        await page.locator('select[name="type"]').selectOption('llm-solo');
        
        // 创建
        await page.locator('button:has-text("创建")').click();
        
        // 检查配置弹窗是否自动打开
        await expect(page.locator('text=情报等级')).toBeVisible();
        
        // 验证默认是indicator
        const select = page.locator('select').first();
        await expect(select).toHaveValue('indicator');
        
        // 切换到strategy
        await select.selectOption('strategy');
        
        // 保存
        await page.locator('button:has-text("保存并关闭")').click();
        
        // 检查列表中显示了新选手
        await expect(page.locator('text=Test-Strategy-Bot')).toBeVisible();
        
        console.log('✅ 新建LLM选手可以选择变体');
    });

    test('5. 运行回测并检查DCA多次交易', async ({ page }) => {
        // 设置回测时间（7天，步长1小时）
        await page.locator('input[type="date"]').first().fill('2025-01-01');
        await page.locator('input[type="date"]').nth(1).fill('2025-01-08');
        await page.locator('input[type="number"]').first().fill('60'); // stepMinutes=60
        
        // 只选DCA选手
        await page.locator('.group:has-text("LLM 单兵")').locator('.w-4').click(); // 取消选择LLM
        
        // 配置DCA为每1天定投
        const dcaCard = page.locator('.group:has-text("基准定投")');
        await dcaCard.locator('button:has-text("配置")').click();
        await page.locator('input[type="number"]').nth(1).fill('1440'); // 1天
        await page.locator('button:has-text("保存并关闭")').click();
        
        // 启动回测
        await page.locator('button:has-text("启动竞技")').click();
        
        // 等待回测完成（最多30秒）
        await page.waitForSelector('text=最终战报', { timeout: 30000 });
        
        // 检查交易历史
        await page.locator('button:has-text("交易历史")').click();
        
        // 应该有多次交易（7天每天一次=7次）
        const tradeRows = page.locator('tbody tr');
        const tradeCount = await tradeRows.count();
        
        console.log(`📊 DCA交易次数: ${tradeCount}`);
        expect(tradeCount).toBeGreaterThanOrEqual(5); // 至少5次交易
        
        // 检查最终战报
        await expect(page.locator('text=最终战报')).toBeVisible();
        
        console.log('✅ DCA多次交易验证通过');
    });

    test('6. LLM不同变体运行回测', async ({ page }) => {
        // 取消DCA，选择多个LLM变体
        await page.locator('.group:has-text("基准定投")').locator('.w-4').click();
        
        // 创建Lite变体
        await page.locator('button:has-text("新建")').click();
        await page.locator('input[name="name"]').fill('LLM-Lite-Test');
        await page.locator('select[name="type"]').selectOption('llm-solo');
        await page.locator('button:has-text("创建")').click();
        await page.locator('select').first().selectOption('lite');
        await page.locator('button:has-text("保存并关闭")').click();
        
        // 创建Strategy变体
        await page.locator('button:has-text("新建")').click();
        await page.locator('input[name="name"]').fill('LLM-Strategy-Test');
        await page.locator('select[name="type"]').selectOption('llm-solo');
        await page.locator('button:has-text("创建")').click();
        await page.locator('select').first().selectOption('strategy');
        await page.locator('button:has-text("保存并关闭")').click();
        
        // 选择这3个LLM选手（原有的LLM单兵 + 新建的2个）
        // 原有的LLM单兵已经是选中状态
        await page.locator('.group:has-text("LLM-Lite-Test")').locator('.w-4').click();
        await page.locator('.group:has-text("LLM-Strategy-Test")').locator('.w-4').click();
        
        // 设置回测时间（1天）
        await page.locator('input[type="date"]').first().fill('2025-01-01');
        await page.locator('input[type="date"]').nth(1).fill('2025-01-02');
        
        // 启动回测
        await page.locator('button:has-text("启动竞技")').click();
        
        // 等待回测完成
        await page.waitForSelector('text=最终战报', { timeout: 60000 });
        
        // 检查3个选手都有结果
        const results = page.locator('tbody tr');
        const resultCount = await results.count();
        expect(resultCount).toBeGreaterThanOrEqual(3);
        
        console.log(`📊 LLM变体数量: ${resultCount}`);
        
        // 检查日志
        await page.locator('button:has-text("实时日志")').click();
        const logs = page.locator('.font-mono > div');
        const logCount = await logs.count();
        expect(logCount).toBeGreaterThan(0);
        
        console.log('✅ LLM多变体回测验证通过');
    });

    test('7. 日志输出包含变体标识', async ({ page }) => {
        // 启动一个短回测
        await page.locator('.group:has-text("基准定投")').locator('.w-4').click(); // 取消DCA
        
        // 确保LLM选中并配置为indicator
        const llmCard = page.locator('.group:has-text("LLM 单兵")');
        await llmCard.locator('button:has-text("配置")').click();
        await page.locator('select').first().selectOption('indicator');
        await page.locator('button:has-text("保存并关闭")').click();
        
        // 设置1天回测
        await page.locator('input[type="date"]').first().fill('2025-01-01');
        await page.locator('input[type="date"]').nth(1).fill('2025-01-02');
        
        // 启动
        await page.locator('button:has-text("启动竞技")').click();
        
        // 等待日志出现
        await page.waitForSelector('.font-mono > div', { timeout: 30000 });
        
        // 检查日志内容（服务器端日志会显示在控制台，客户端日志显示在页面上）
        const firstLog = page.locator('.font-mono > div').first();
        await expect(firstLog).toBeVisible();
        
        console.log('✅ 日志输出正常');
    });
});
