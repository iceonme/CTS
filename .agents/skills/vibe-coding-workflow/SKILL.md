---
name: vibe-coding-workflow
description: 一套基于“文件驱动”的人机协作 (VibeCoding) 协议。通过将项目管理解构为战略、战术、执行与记忆四个层级，实现 Human 意图与 AI 执行的深度同步。适用于所有需要 AI 深度参与的工程项目。
---

# VibeCoding Workflow (协议 Skill)

本协议旨在通过结构化的文档管理，消除 AI 助手在复杂工程开发中的“漂移”与“遗忘”，确立人机协作的最高工程标准。

## 1. 核心架构 (The Hierarchy)

| 层级 | 核心组件 | 物理位置 | 职责 |
|:---:|:---|:---|:---|
| **Strategic (战略)** | **白皮书 (Whitepaper)** | `docs/VISION.md`, `docs/ROADMAP.md` | 决定“为什么做”以及产品的灵魂与演进路线。 |
| **Tactical (战术)** | **任务看板 (Board)** | `docs/task/BOARD.md` | 管理当前的“核心战役”，定义 PLAN、TODO 与已验证的任务成果。 |
| **Operational (执行)** | **大脑清单 (Task)** | 系统内置 `task.md`, `implementation_plan.md` | AI 的微观执行清单，详细描述编码逻辑与变更方案。 |
| **Memory (记忆)** | **交接日志 (Handover)** | `docs/HANDOVER.md`, `docs/task/history/` | 维护项目的短/长期记忆，确保存量代码的可追溯性。 |

## 2. 交互闭锁协议 (The Sync Protocol)

在执行过程中，AI 必须遵守以下铁律：

### 阶段 A：规划 (Planning)
1. **同步看板**：将 `BOARD.md` 中的某个 TODO 项拆解到脑内的 `task.md`。
2. **制定方案**：编写 `implementation_plan.md`，明确变更范围与技术选型。
3. **获取授权**：严禁在未经用户确认方案前修改任何逻辑代码。

### 阶段 B：执行 (Execution)
1. **进度更新**：每完成一个原子步骤，同步更新脑内 `task.md` 进度。
2. **逻辑纯粹**：所有代码变更必须严格符合已批准的 `implementation_plan.md`。

### 阶段 C：验收 (Verification)
1. **生成报告**：任务结束后生成 `walkthrough.md`。
2. **功劳归档**：将 `walkthrough.md` 强制复制一份到 `docs/task/history/` 目录，文件名为 `YYYY-MM-DD_HH-mm_description.md`。
3. **闭环看板**：在 `BOARD.md` 中勾选任务，并加上对应的 history 文件链接。

## 3. 记忆维护 (Memory Management)

- **短期记忆 (Pulse)**：在 `docs/HANDOVER.md` 中记录进展。**要求**：必须使用具体时间戳与序号（如 `Log #YYYYMMDD-N`）标记每次记录，以支持单日多次交接。
- **长期记忆 (Library)**：通过 `docs/insights/` 沉淀技术决策建议（ADR）或深度洞察（INS-XXX）。

## 4. 使用建议

当用户开启新项目或重整项目结构时，AI 应主动引导用户建立此四级目录结构，以实现最高效的 VibeCoding 体验。
