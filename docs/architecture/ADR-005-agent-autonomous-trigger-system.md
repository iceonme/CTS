# ADR-005: Agent 自主触发与环境解耦架构

## 状态
**Proposed**

## 上下文 (Context)
在 TradeMind 系统中，Agent（特别是 PA 队长）需要具备高度的自主性，能够根据时间、事件或随机因素主动发起思考和行动。同时，系统需要支持多种运行环境：
1. **生产环境 (Production)**：按真实世界的时间节拍运行。
2. **回测环境 (Arena)**：在虚拟时间内加速运行，要求行为逻辑与生产环境完全一致。
3. **真实比赛 (Live Match)**：结合生产环境的实时性与竞技场的公平接口。

为了满足这些需求，我们需要一种既能保证 Agent 自主定义行为节拍，又能被外部环境受控驱动的架构。

## 决策 (Decision)

我们决定采用基于 **Clock 抽象注入** 的 **自主调度器 (Scheduler)** 架构。

### 1. 时钟抽象 (Clock Abstraction)
定义统一的 `IClock` 接口，Agent 内部所有与时间相关的操作必须依赖此接口。
- **RealClock**: 包装系统时间，用于生产环境。
- **VirtualClock**: 受控于回测引擎（如 Arena），允许时间“跳跃”或“加速”。

### 2. BaseAgent 内置调度器 (Autonomous Scheduler)
每个 Agent 内部持有一个 `Scheduler` 实例，由注入的 `Clock` 驱动。Agent 可以自主注册三类触发器：

| 触发器类型 | 定义 | 典型场景 |
|------------|------|----------|
| **CRON (计划)** | 基于时间间隔的周期性任务 | 每分钟分析 K 线、每天进行自省、每 10 分钟发送一次 Feed |
| **EVENT (事件)** | 对外部信号（L3 Feed）的即时反应 | 接收到 Polymarket 赔率剧变信号、技术指标突破信号 |
| **STOCHASTIC (随机)** | 模拟非线性或突发性的扫描行为 | 随机深度扫描市场、突发奇想的策略微调 |

### 3. 环境绑定逻辑 (Binding)
Agent 的**行为定义**是自主的（代码层面），但其**动力源**由环境在初始化时注入：

```typescript
// 1. 初始化
const clock = isBacktest ? new VirtualClock() : new RealClock();
agent.initialize(clock);

// 2. 行为注册 (Agent 自主定义)
this.scheduler.registerCron('1m', () => this.analyzeKlines());
this.scheduler.registerEvent('POLY_SHOCK', (data) => this.alertUser(data));
```

## 影响 (Consequences)

### 优点
1. **高度自主性**：Agent 掌握着自己的发条，不依赖于外部显式的 `onTick` 循环来定义其思考逻辑。
2. **环境一致性**：同一份 Agent 代码（含触发逻辑）在回测中是“倍速重放”，在实盘中是“自然流转”，逻辑完全闭环。
3. **易于测试**：可以通过操作 `VirtualClock` 精确模拟各种时间点的突发事件。

### 挑战
1. **异步控制**：在回测环境下，需要确保 Scheduler 的异步任务执行顺序与虚拟时间步长对齐，防止“时间超前”。
2. **持久化要求**：Agent 的触发器状态（如 `lastRunTimestamp`）需要作为状态的一部分进行持久化，以便系统重启后恢复节拍。

## 相关参考
- [ROADMAP.md](../ROADMAP.md) (v0.1.x 规划)
- [VISION.md](../VISION.md) (L1-L3 架构层次)
