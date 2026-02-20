# ADR-004: 数据驱动与环境无关性规范

## 状态
提议中

## 背景
目前系统存在 Arena（回测）和 Production（实盘）两套驱动逻辑，但 Agent 的核心逻辑需要在这两个环境中保持一致。为了实现高效的协作和解耦，需要明确层次结构。

## 决策

### 1. 三层架构模型
我们将系统划分为：
- **Data Layer (数据层)**: 封装原始 K 线、Polymarket 概率等数据。提供 `get_klines()`, `get_market_state()` 等纯函数接口。
- **Calling Layer (分析层)**: 封装为 **Skills**。这是 LLM 通过 Function Call 访问的唯一层次。
- **Messaging Layer (信号层)**: **FeedBus** 的运行场所。Agent 在此层发布分析结论（而非原始数据），供其他 Agent 订阅。

### 2. 驱动隔离协议
- **VirtualClock 注入**: 所有的 `onTick` 和 `Skill` 调用必须显式使用注入的 `IClock`。
- **执行拦截**: 在 Arena 模式下，`set_target_position` 指令必须被拦截并转发至 `VirtualPortfolio`；在 Production 模式下，转发至真实交易所 API。

### 3. 信息利用效率测试 (MAS vs Solo)
我们将通过 Arena 对比以下两种模式：
- **模式 A**: 单兵 Agent 直接通过 Calling Layer 调用多个分析工具。
- **模式 B**: MAS 小队通过 Messaging Layer 交换轻量化 Feed。

## 后果
- 极大地提升了系统的可回测性。
- 分层清晰，降低了 AI 编写新 Agent 时的心智负担。
- 可能会增加一定的初期接口开发成本。
