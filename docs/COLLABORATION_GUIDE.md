# 项目协作指南 (VibeCoding)

本指南旨在确立一种基于“文件驱动”的开发模式，确保人类开发者与 AI 助手之间的意图同步及项目记忆的持久化。

## 1. 核心协作架构 (Docs Structure)

项目文档分为四个层级，请在对应的文件夹下创建和维护文档：

### 战略层 (Strategic)
- **`VISION.md`**: 定义“为什么做”，产品的核心价值与灵魂。
- **`ROADMAP.md`**: 演进路线图，定义不同阶段的目标。

### 战术层 (Tactical)
- **`docs/task/BOARD.md`**: **看板**。管理当前活跃的任务（TODO / PLAN / DONE）。在动手前，所有任务必须在看板中体现。

### 执行层 (Operational)
- **AI 过程文件**: AI 在运行任务时会自动生成 `task.md` 和 `implementation_plan.md`。这些是 AI 的大脑清单，用于确保执行逻辑正确。

### 记忆层 (Memory)
- **`docs/HANDOVER.md`**: **交接日志**。记录每日进展。必须使用 `Log #YYYYMMDD-N` 标记。
- **`docs/task/history/`**: **执行报告存档**。归档后的 `walkthrough.md`。命名规则：`YYYY-MM-DD_HH-mm_简短描述.md`。
- **`docs/architecture/`**: **架构决策 (ADR)**。重大设计方案应提炼至此。命名规则：`ADR-XXX-描述.md`。
- **`docs/insights/`**: **技术洞察**。实验结论或深度分析。命名规则：`INS-XXX-描述.md`。

---

## 2. 交互铁律 (The Sync Protocol)

无论是人类还是 AI，在执行变更时必须遵守以下闭环流程：

1.  **同步看板**：将 `BOARD.md` 中的项拆解为具体计划。
2.  **规划先行**：在修改任何代码逻辑前，必须先编写方案并获得用户确认。
3.  **闭环归档**：任务结束后，必须生成执行报告并将其复制归档到 `docs/task/history/`。

---

## 3. 过程文件处理规范 (Artifact Lifecycle)

-   **`task.md`**: 阅后即焚，不存档。
-   **`implementation_plan.md`**: 常规任务不存档；若涉及重大架构变更，与用户交流确定后可将其核心逻辑提炼为 `ADR-XXX.md` 存入 `architecture/`。
-   **`walkthrough.md`**: **必须强制联动归档**至 `docs/task/history/`，作为项目进度的物理追踪点。
