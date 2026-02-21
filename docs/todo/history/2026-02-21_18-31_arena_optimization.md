# 记录日期：2026-02-21 18:31
# 任务目标：修复 Klines API 并优化 Arena UI

## 1. 技术突破：DuckDB 并发冲突彻底解决
### 问题诊断
- 现象：高频请求 `/api/market/klines` 会触发 `INTERNAL Error: Attempted to dereference unique_ptr that is NULL!`。
- 根因：Next.js 在 HMR 模式下会导致 `klines` API 和 `RaceController` 重复实例化 `duckdb.Database`，多个 C++ 句柄抢占同一个文件锁导致指针异常。
### 解决方案
- **全局单例锁定**：在 `lib/data/market-db.ts` 中使用 `globalThis.__market_db_singleton` 强制锁定唯一的 DB 实例。
- **模式探测**：构造函数尝试打开数据库，若被锁定则自动捕获错误并切换到 `READ_ONLY` 模式。
- **异步隔离**：统一 API 路由使用 `queryRaw()` 接口同步复用已有的数据库连接，不再自建实例。

## 2. UI 增强：K 线图表与进度指示器
### 关键优化点
- **数据分割逻辑**：
    - 根据回测当前 `currentTimestamp` 实时计算 `pastData` 与 `futureData`。
    - “未来” K 线采用低饱和度灰度渲染，提供直观的时间流逝感。
- **CSS 虚拟线技术**：
    - 抛弃 `lightweight-charts` 原生的 `LineSeries` 指示线（因为两点模拟的线在高频移动时会有倾斜和性能消耗）。
    - 采用原生 DOM Div 作为 Overlay，通过组件内的 `useEffect` 配合 `timeScale().timeToCoordinate()` 进行 X 轴精确定位。
- **Interval 联动**：
    - 支持 15m/1h/1d 动态切换，且切换后自动调用 `fitContent()` 适配视野。

## 3. Arena 交互细节优化
- **选手级筛选**：
    - 点击选手卡片的“⚙️ 配置”旁新增的“选手详情”按钮，可触发 Tab 区域数据过滤。
    - 过滤逻辑：`logs.filter(l => l.contestantName === selected)`。
- **交易表格增强**：
    - 新增 `金额 (USDT)` 列。
    - 逻辑：`num * price`。卖出（SELL）显示绿色（收入），买入（BUY）显示红色（成本）。

## 4. 后续建议
- 目前 DuckDB 已非常稳定，但若文件损坏仍需手动清理。
- 建议未来增加 `KlinePriceChart` 的“多币种支持”，目前固定为 `BTCUSDT`。
