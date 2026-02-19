# ADR-003: 回测框架与时钟注入 (Clock Injection)

## 状态
提议 (Proposed)

## 背景
当前 TradeMind 系统的 Agent（如 TechnicalAnalyst）主要通过订阅 `FeedBus` 的行情 Feed 来驱动。在回测场景下，`ReplayEngine` 负责快进时间并发布历史行情 Feed。

然而，这种“推模式”存在以下问题：
1. **时间不一致**: Agent 内部计算指标（如 RSI）时，如果直接使用 `Date.now()`，会导致历史回测使用了当前真实时间。
2. **架构差异**: 实盘需要 `setTimeout` 驱动，而回测需要快进，两套逻辑难以统一。
3. **MAS 边界**: `FeedBus` 应该仅用于 Agent 之间的观点交流，而不应作为原始行情的分发手段。

## 决策
我们将架构改为**“时钟注入 (Clock Injection)”**模式，具体决策如下：

### 1. 引入 IClock 接口
所有 Agent 和系统组件不再直接调用 `Date.now()`，而是通过注入的 `IClock` 接口获取时间。

```typescript
interface IClock {
  now(): number; // 返回当前 Unix 时间戳
}
```

- **SystemClock**: 用于实盘，返回真实系统时间。
- **VirtualClock**: 用于回测，时间由 `RaceController` 手动推进。

### 2. 从“推模式”转为“拉模式”
- `ReplayEngine` 仅负责控制 `VirtualClock` 的推进，不再发布行情 Feed。
- Agent 通过 `onTick` 或者内部定时器检测到时间变化后，主动向 `MarketDB` 查询所需的数据。
- 查询时必须带上时间上限：`db.query(symbol, { until: clock.now() })`。

### 3. Contestant (参赛者) 抽象
为了支持回测比赛，引入 `Contestant` 接口。
- 每个参赛者拥有独立的 `FeedBus`（用于 MAS 内部协作）和 `VirtualPortfolio`（用于虚拟持仓）。
- 比赛控制器 `RaceController` 负责协调所有参赛者的步进。

## 后果
### 优点
- **架构统一**: 相同的 Agent 代码可以无缝切换实盘和回测。
- **确定性**: 回测结果在相同数据和参数下完全可复现。
- **灵活性**: 方便增加不同类型的参赛者（MAS, LLM, DCA）。

### 缺点
- **重构成本**: 需要修改现有 Agent（PA, TechAnalyst）获取时间的方式。
- **性能开销**: Agent 主动拉取数据可能比被动接收推送到内存的数据开销略大（可通过 DB 缓存优化）。
