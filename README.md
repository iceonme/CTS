# TradeMind (Powered by AAAgent)

> **让每个人都能拥有专业的 AI 交易团队**

TradeMind 是一个加密交易多智能体（MAS）系统，它是底层 **AAAgent (Autonomous Account Agent)** 框架在金融交易领域的首个参考实现。TradeMind 通过组建 **Crypto Trade Squad (CTS)**，模拟专业交易团队的协作逻辑，帮助用户实现 7x24 小时的市场洞察与自动化决策。

---

## 🌟 项目简介

本项目旨在构建一个高度模块化、可进化的交易智能体小队。核心优势包括：
1. **多维度协作 (MAS)**：不同于传统的单一策略脚本，TradeMind 采用多个 Agent（技术分析员、巨鲸监控员、PA 队长）通过辩论与协作达成共识。
2. **三层记忆系统**：具备会话短期记忆、个体成长记忆与小队群体记忆。
3. **环境无关驱动**：支持 Arena（加速回测引擎）与 Production（真实市场心脏）两种模式。
4. **自进化能力**：系统级内置 Skill Factory，支持 Agent 自动化生成新技能与推理 Spec。

---

## 🏗️ 底层框架：AAAgent (Autonomous Account Agent)

AAAgent 是一套通用的自主智能体框架系统，旨在定义具备“独立经济模型与运行底座”的下一代 AI 实体。TradeMind 深度应用了 AAAgent 的三层宏观架构与八大能力模块：

### 1. 三层架构 (AAAgent 3-Layer System)
- **L1 构建层 (Construction Layer)**：定义单体 Agent 的本体机构。
- **L2 通信协作层 (Communication Layer)**：多 Agent 间的 Feed 总线与协作协议。
- **L3 经济信誉层 (Economic Layer)**：AAAgent 原生的激励机制、信用评价与账户模型。

### 2. 构建层八大模块 (AAAgent 8 Modules)
所有 AAAgent 实体（如 TradeMind 中的 CTS 成员）均由以下模块组装而成：
- **物理性**：Node, Channel。
- **智能性**：Sense, Think, Act, Self-Evolution。
- **底座状态**：Memory, Autonomy。

详细定义请参考 [INS-002: Agent 构建层框架](./docs/insights/INS-002-agent-construction-layer-framework.md)。

---

## 🎭 协作模式与文档管理

**本项目由人-AI 共同完成 (VibeCoding)，采用以下文档驱动管理模式：**

### 1. 战略级：白皮书 (Strategic Whitepaper)
- [VISION.md](./docs/VISION.md) - 产品使命、核心价值与终极形态。
- [ROADMAP.md](./docs/ROADMAP.md) - 演进路线图与长期里程碑。
- [Insights/](./docs/insights/) - 各领域深度研究与理论蓝图 (INS-XXX)。

### 2. 战术级：任务看板 (Tactical Board)
- [BOARD.md](./docs/task/BOARD.md) - **正在进行的任务看板**。定义 PLAN (积压)、TODO (当前战役) 与已验证完毕的任务成果。

### 3. 执行与记忆 (Operational & Memory)
- **执行逻辑**：AI 脑部内置的 `implementation_plan.md` (设计方案) 与 `task.md` (编码清单)。
- **项目记忆**：
  - [HANDOVER.md](./docs/HANDOVER.md) - **短期记忆**。记录每日进展脉搏与即时上下文。
  - [Archive/](./docs/archive/) - **过时归档**。存放过时的设计草案或已废弃的方案。
  - [History/](./docs/task/history/) - **长期记忆**。存档所有历史验收报告 (Walkthrough)。

---

## 📂 目录结构

```bash
CTS/
├── README.md                 # 项目门户（本文档）
├── docs/                     # 统一文档中心
│   ├── architecture/         # 技术架构设计 (ADR, 技术指南)
│   ├── insights/             # 研究洞察 (INS-XXX 系列白皮书)
│   ├── archive/              # 过时方案归档
│   ├── task/                 # 任务看板 (BOARD.md) 与 历史 (History)
│   ├── VISION.md             # 战略愿景
│   ├── ROADMAP.md            # 战略路线图
│   └── HANDOVER.md           # 战地日志 (项目记忆)
├── arena-history/            # 竞技场记录 (回测战报、比赛 JSON)
├── my-app/                   # 核心应用代码 (Next.js)
└── .agents/                  # Agent 配置与技能工厂产出物
```

---

## 🚀 快速启动

1. **安装环境**: `npm install`
2. **开发者运行**: `npm run dev`
3. **主入口**:
   - [竞技场 (/arena)](http://localhost:3000/arena) - 进行策略博弈与历史回测。
   - [协同作战室 (/squad)](http://localhost:3000/squad) - 观察多智能体实时协作。

---

**TradeMind 团队**
*AI-First Cryptocurrency Trading MAS Framework*
