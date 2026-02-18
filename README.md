# TradeMind

> **让每个人都能拥有专业的 AI 交易团队**

TradeMind 是一个多智能体（MAS）交易助手系统，通过 AI 组成的虚拟交易团队，帮助个人投资者 7x24 小时盯盘、分析、执行交易。

---

## 🚀 快速开始

### 项目文档

| 文档 | 说明 |
|------|------|
| [docs/VISION.md](./docs/VISION.md) | 产品大愿景 - 我们要解决什么问题，最终要成为什么 |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | 版本路线图 - 每个阶段要做什么（当前：v0.1 挑战赛）|
| [docs/HANDOVER.md](./docs/HANDOVER.md) | 工作日志 - 今天做了什么，接下来做什么 |
| [docs/architecture/](./docs/architecture/) | 技术架构设计文档 |

### 新成员 onboarding

1. 阅读 [VISION.md](./docs/VISION.md) - 理解产品愿景
2. 阅读 [ROADMAP.md](./docs/ROADMAP.md) - 了解当前版本需求
3. 阅读 [HANDOVER.md](./docs/HANDOVER.md) - 了解最近进展
4. 阅读相关 [architecture/](./docs/architecture/) - 理解技术设计

---

## 📚 文档体系

所有文档统一放在 `docs/` 目录下：

```
docs/
├── VISION.md                 # 产品大愿景（长期稳定）
├── ROADMAP.md                # 版本路线图（规划时更新）
├── HANDOVER.md               # 工作日志（每日更新）
├── architecture/             # 技术架构设计
│   ├── ADR-001-agent-framework.md
│   ├── ADR-002-prediction-feedback-loop.md
│   └── quantitative-indicators-guide.md
└── product/                  # 产品详细（历史参考）
    └── product_vision.md
```

### 归档文档

| 文档 | 说明 | 状态 |
|------|------|------|
| [archive/](./docs/archive/) | 历史文档（product_vision, implementation_plan, mvp_functional, system_design）| ⚠️ 过时 |

---

## 🏗️ 项目结构

```
CTS/
├── README.md                 # 本文档（项目入口）
├── docs/                     # 文档目录
│   ├── VISION.md             # 产品愿景
│   ├── ROADMAP.md            # 版本路线图
│   ├── HANDOVER.md           # 工作日志
│   ├── architecture/         # 技术架构
│   └── product/              # 产品详细（历史参考）
├── my-app/                   # 代码目录（Next.js）
│   ├── app/                  # 页面
│   ├── lib/                  # 核心代码
│   │   ├── agents/           # Agent 实现
│   │   ├── core/             # 框架核心
│   │   ├── skills/           # Skills
│   │   └── data/             # 数据层
│   └── data/                 # 数据文件
│       └── market-v2.db      # 2025全年行情数据
└── .agents/                  # Agent 配置
```

---

## 🛠️ 开发环境

```bash
# 1. 进入项目
cd my-app

# 2. 安装依赖
npm install

# 3. 启动开发
npm run dev

# 4. 访问
# http://localhost:3000 - 主应用
# http://localhost:3000/chart - 图表页面
```

---

## 📊 当前状态

**v0.1 挑战赛版本 - 进行中**

构建交易挑战赛平台，让 MAS 小队 vs 人类基准 vs LLM 单兵在相同历史数据上竞技。

### 已完成 ✅
- 2025 全年 BTC 1分钟数据（50万+条）
- 数据回放引擎 ReplayEngine
- TradeMind Agent 框架（BaseAgent、记忆系统、FeedBus）

### 进行中 🚧
- 参赛者系统（DCA、MAS、LLM）
- MAS 小队盯盘→研判→交易流程
- 评估与可视化

详见 [docs/HANDOVER.md](./docs/HANDOVER.md)

---

## 🔄 文档更新规则

| 场景 | 更新文档 |
|------|----------|
| 每天工作记录 | **HANDOVER.md** |
| 需求/版本调整 | **ROADMAP.md** |
| 产品方向变化 | **VISION.md** |
| 技术架构变更 | **architecture/ADR-XXX.md** |

---

## 🤝 贡献

参见 [docs/HANDOVER.md](./docs/HANDOVER.md) 了解当前任务和下一步工作。

---

**TradeMind 团队**  
*让 AI 成为你的交易伙伴*
