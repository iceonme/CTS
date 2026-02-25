# Arena UI 优化 Walkthrough

## 变更概述

在 Arena 回测竞技场页面上实现了四项 UI 优化：

1. **K 线价格图表** — 在净值曲线上方新增 CandlestickSeries 图表
2. **买卖标记** — 在 K 线图上显示 B/S 箭头标签
3. **选手筛选** — 点击选手卡片可筛选日志和交易记录
4. **交易记录完善** — 增加日期和 USDT 金额列

## 修改的文件

| 文件 | 类型 | 说明 |
|------|------|------|
| [KlinePriceChart.tsx](file:///c:/Projects/can/my-app/app/components/backtest/KlinePriceChart.tsx) | 新建 | K 线图表组件 (~290行) |
| [page.tsx](file:///c:/Projects/can/my-app/app/arena/page.tsx) | 修改 | 整合新组件、状态管理、筛选逻辑 |
| [route.ts](file:///c:/Projects/can/my-app/app/api/market/klines/route.ts) | 修改 | 新增 start/end 范围查询参数 |

## 功能实现详情

### K 线图表 (KlinePriceChart.tsx)

- 使用 `lightweight-charts` v5 的 `CandlestickSeries`
- 两组 Series：已过时间正常颜色（绿涨红跌），未来时间半透明灰色
- 时间周期切换：15分钟 / 1小时（默认）/ 日线，点击按钮重新加载对应 interval 数据
- 进度指示线（蓝色虚线）标记当前模拟时间位置
- `createSeriesMarkers` 添加 B/S 箭头标记

### 选手筛选

- 选手卡片增加「📋 详情」按钮（hover 显示，选中后常驻高亮）
- Tab 栏右侧显示筛选标签 + ✕ 清除按钮
- 日志和交易面板根据 `selectedContestantForDetail` 过滤显示

### 交易表格

- 时间列：从 `toLocaleTimeString()` 改为 `toLocaleString('zh-CN', { month, day, hour, minute })`
- 新增「金额 (USDT)」列：买入红色 `-$xxx`，卖出绿色 `+$xxx`

## 验证结果

- ✅ `next build` 编译成功（Compiled successfully）
- ✅ Arena 相关文件 lint 通过
- ⬜ 浏览器视觉检查待用户手动验证
