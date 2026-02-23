# TradeMind

> **让每个人都能拥有专业的 AI 交易团队**

TradeMind 是一个多智能体（MAS）交易助手系统。通过 AI 组成的虚拟交易团队，帮助个人投资者实现 7x24 小时自动盯盘、市场研判与策略执行。

---

## 🚀 快速导航

### 核心页面
- [竞技场 (/arena)](http://localhost:3000/arena) - 多选手回测与策略对比
- [情报流 (/feed)](http://localhost:3000/feed) - 实时市场情报与 Agent 预警
- [作战室 (/warroom)](http://localhost:3000/warroom) - 市场情绪仪表盘与多维度分析
- [K线图表 (/chart)](http://localhost:3000/chart) - 深度集成行情系统

### 项目文档
| 文档 | 说明 |
|------|------|
| [VISION.md](./docs/VISION.md) | **产品愿景** - 解决什么问题，最终形态 |
| [ROADMAP.md](./docs/ROADMAP.md) | **路线图** - 阶段目标（当前：v0.1 挑战赛） |
| [HANDOVER.md](./docs/HANDOVER.md) | **工作日志** - 增量开发记录 |
| [architecture/](./docs/architecture/) | **技术设计** - 框架、算法与 ADR 记录 |
| [insights/](./docs/insights/) | **深度洞察** - 策略训练、进化机制等研究 |
| [arena-history/](./docs/arena-history/) | **回测存档** - 历史回测数据与战报记录 |

---

## 🏗️ 目录结构 (Naming Conventions)

项目遵循统一的模块化命名规范：

```bash
CTS/
├── README.md                 # 项目门户（本文档）
├── docs/                     # 统一文档中心 (Documentation Center)
│   ├── architecture/         # 技术架构设计 (ADR, 技术指南)
│   ├── insights/             # 研究洞察 (AI 训练、模型进化)
│   ├── arena-history/        # 竞技场记录 (回测存档、比赛战报)
│   ├── VISION.md             # 产品愿景与最终形态
│   ├── ROADMAP.md            # 路线图与阶段目标
│   └── HANDOVER.md           # 开发进度与工作日志
├── my-app/                   # 核心应用代码 (Next.js Application)
│   └── README.md             # 技术/开发者指南（配置、API、部署）
└── .agents/                  # Agent 配置与工具集成
```

---

## 🛠️ 模块概览

1. **竞技场 (Arena)**: 允许 MAS 小队、LLM 单兵与基准策略（如 DCA）在相同历史数据下进行公平竞技。
2. **多智能体框架 (MAS Framework)**:
   - **PA (Portfolio Agent)**: 决策中枢，管理仓位与工具调用。
   - **技术分析员 (Tech Analyst)**: 信号发生器，提供 RSI/MACD 等量化支撑。
   - **CFO**: 提供宏观研判与牛熊对冲逻辑。
3. **策略工具箱**:
   - **Grid (网格策略)**: 负责震荡行情中的高抛低吸。
   - **DCA (定投策略)**: 负责长期价值积攒。
4. **数据引擎 (Data Engine)**:
   - 包含 2025 全年 BTC 1分钟数据。
   - 支持多级聚合（1m -> 15m/1h/1d）。

---

## 📊 当前状态

**当前里程碑: v0.1 挑战赛 (In Progress)**

- [x] **基础设施**: 2025 全年行情、高性能 K 线、虚拟时钟回放。
- [x] **选手优化**: Grid 策略深度优化（动态跟随、递归分仓）。
- [x] **图表增强**: 初始对焦锁定、全周期切换、回归问题修复。
- [ ] **PA 工具化**: 正在将 Grid/DCA 封装为 PA 可调用的原子工具。
- [ ] **评估系统**: 已实现夏普比率、最大回撤计算。

详见 [docs/ROADMAP.md](./docs/ROADMAP.md)

---

## 🔄 同步与规范

1. **命名规范**:
   - 统一使用 **TradeMind** 作为项目正式名称。
   - 核心术语：**智能体 (Agent)**、**竞技场 (Arena)**、**回测 (Backtest)**、**回看 (Lookback)**。
2. **文档更新**:
   - 每日进展记录在 `docs/HANDOVER.md`。
   - 架构重大变更记录在 `docs/arch/ADR-XXX.md`。

---

**TradeMind 团队**
*AI-First Cryptocurrency Trading MAS Framework*
