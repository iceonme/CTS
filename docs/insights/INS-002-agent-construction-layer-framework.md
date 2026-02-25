# INS-002: AAAgent 构建层框架 (AAAgent Construction Layer)

## 1. AAAgent 宏观架构三层模型 (The Three-Layer System)

AAAgent (Autonomous Account Agent) 是一套为实现具备独立账户与经济博弈能力的智能体而设计的通用系统。它被解构为三个互补的层级：

### L1: 构建层 (Agent Construction Layer)
- **目标**: 定义“单体智能体 (Single Agent)”的本体结构。
- **定位**: Agent 的“身体与大脑”，决定了单个智能体如何生存、感知和决策。
- **核心**: 包含 8 大核心能力模块。

### L2: 通信社交协作层 (Communication & Social Layer)
- **目标**: 定义多智能体（MAS）之间的信息交换与协作协议。
- **定位**: Agent 的“社交圈与 War Room”，解决 Feed 发布订阅、信号共识、团队决策与博弈问题。

### L3: 经济信誉层 (Economic & Reputation Layer) — 未来演进
- **目标**: 定义 Agent 之间的价值交换、信用激励与资源分配机制。
- **定位**: Agent 的“社会经济学”，解决任务激励、贡献度量化与信誉评价。

---

## 2. 构建层八大核心模块 (The Eight Modules)

单体 Agent 遵循以下高度解耦、职责明确的模块化结构：

### 1. 感知 (Sense)
- **输入源**: 
  - 外部事实数据（L1/L2，如行情、指标、链上数据）。
  - 通信消息（L3 Feed，来自其他 Agent 或人类用户的消息）。
- **职责**: 负责将非结构化的环境信号转化为 Agent 可理解的内部状态。

### 2. 思考 (Think) — 大脑与推理规范
- **核心**: LLM 作为大脑处理器。
- **推理规范 (Reasoning Spec)**: 
  > [!NOTE]
  > 推理方式是可插拔的“认知架构”，决定了 Agent 如何处理感知到的信息。
- **模式扩展**: 
  - **通用模式**: CoT (思维链), ReAct (推理+行动)。
  - **实战模式**: OODA (观察-定位-决策-行动), SWOT (优劣势分析), 波特五力分析。
- **定位**: 推理方式被定义为 Spec/Skill 的特殊形式，决定了 Agent 的“思维深度”。

### 3. 行动 (Act) — 技能与工具
- **Skill**: 对工作流的抽象，组合了多个工具。
- **Tool**: 底层原子函数接口（API 调用、本地计算）。
- **协议**: 支持 MCP (Model Context Protocol) 动态发现和加载工具。

### 4. 记忆 (Memory)
- **时效分层**:
  - **L1 (Session)**: 短期会话/决策上下文。
  - **L2 (Individual)**: Agent 个体成长、习惯与表现统计。
  - **L3 (Collective)**: 群体共享知识、市场共识。
- **形态演进**: 初始采用文件持久化，未来支持 Knowledge Graph (知识图谱) 实现语义关联。

### 5. 自主性 (Autonomy) — 内部引擎
- **触发器 (Triggers)**: 
  - **时间驱动**: Cron/定时任务。
  - **事件驱动**: 外部信号反馈响应。
  - **随机驱动**: 模拟“突发奇想”或随机扫描。
- **动态时钟**: 通过 `IClock` 注入，支持 Real-time 与 Simulation 环境切换。

### 6. 自进化 (Self-Evolution) — 元能力
- **技能创作者 (Skill Factory)**: 自动化生成新的 `SKILL.md` 和 `tool-schema`。
- **闭环进化**: 结合记忆模块，分析过去决策的成败结论，主动提炼/修正自身的推理策略或技能。

### 7. 运行节点 (Node) — 物理承载与权限
- **核心**: Agent 运行的物理或虚拟环境标识。
- **职责**: 
  - 定义 Agent 的物理边界（如：Local, Edge, Cloud）。
  - 控制对本地资源（文件系统、硬件接口、私有密钥）的访问权限。
- **定位**: 决定了 Agent 的“物理安全性”与“执行可信度”。

### 8. 交互渠道 (Channel) — 通话窗口与交互
- **核心**: Agent 与外界（人类或其他系统）的通信适配器。
- **职责**: 
  - 负责消息的格式转换、异步推送与用户身份验证。
  - 适配不同的交互端：Telegram, Discord, WebUI, REST API 等。
- **定位**: 确保 Agent 的决策输出能精准、安全地触达目标受众。

---

## 3. 架构共识

**BaseAAAgent** 应作为这一“构建层”的物理实现底座。TradeMind (加密交易) 正是基于 AAAgent 的这一底座，通过组建 **Crypto Trade Squad (CTS)** 实现了领域特定的协同博弈。
