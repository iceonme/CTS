# ADR-001: TradeMind Agent 框架设计

**日期**: 2026-02-17  
**状态**: 已接受  
**作者**: 开发团队

---

## 背景

在 TradeMind AI 项目中，我们需要设计一个支持多智能体协作的框架。经过评估市面上的框架（Vercel AI SDK、Mastra、LangChain），发现它们都无法完美满足**数字资产交易**这一特殊场景的需求。

---

## 决策

**自研轻量级 Agent 框架 - TradeMind Framework**

### 核心设计原则

1. **交易原生**: 风控、仓位管理、盈亏追踪内置
2. **多智能体协作**: 不止一个 AI，而是一个团队
3. **可进化记忆**: 三层记忆体系（会话/个体/群体）
4. **完全可控**: 可深入修改任何逻辑

---

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    用户界面层                             │
│         (与 PA 对话 / 配置 Agent / 查看数据)             │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  PA (Personal Assistant) - 主智能体                      │
│  ═══════════════════════════════════                    │
│  职责：唯一对话入口、决策中枢、团队协调                    │
│                                                          │
│  核心能力：                                               │
│  ├── Bull/Bear 双视角推理（内心独白）                     │
│  ├── 主动任务执行（盯盘/找机会/异动/报告）                │
│  ├── Skill 编排与执行                                    │
│  └── 其他 Agent 管理                                     │
└─────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  技术分析员  │   │ Polymarket │   │  自定义     │
│  📊         │   │   专员 🎯   │   │  Agent     │
└─────────────┘   └─────────────┘   └─────────────┘
        │                │                │
        └────────────────┼────────────────┘
                         ▼
              ┌─────────────────────┐
              │     共享记忆层       │
              │  ├─ 群体智慧         │
              │  ├─ 市场共识         │
              │  └─ 历史经验         │
              └─────────────────────┘
```

---

## 技术架构

### 1. 分层设计

```
Layer 3: Workflow（业务流程编排）
         例如：盯盘流程 = 获取数据 → 分析 → 决策 → 执行

Layer 2: Skill（业务能力模块）
         例如：trade:execute, analysis:market, feed:publish
         Skill 可以组合多个 Tools

Layer 1: Tool（底层工具）
         例如：coingecko:price, portfolio:trade
         直接调用外部 API 或本地函数
```

### 2. BaseAgent 抽象

```typescript
abstract class BaseAgent {
  // 身份与个性
  abstract identity: AgentIdentity;
  abstract prompts: AgentPrompts;
  
  // 能力（依赖注入）
  protected skills: Map<string, Skill>;
  protected tools: Map<string, Tool>;
  
  // 记忆系统（三层）
  readonly memory: {
    shortTerm: SessionMemory;   // 会话级
    longTerm: IndividualMemory; // Agent 个体级
    collective: CollectiveMemory; // 群体共享
  };
  
  // 核心方法
  abstract chat(message: string): Promise<string>;
  executeSkill(skillId: string, params: any): Promise<any>;
  executeWorkflow(workflow: Workflow): Promise<any>;
  
  // 钩子（子类可覆盖）
  protected beforeSkillExecute(skillId: string, params: any): Promise<void>;
  protected afterSkillExecute(skillId: string, result: any): Promise<void>;
}
```

### 3. 记忆系统（核心创新）

#### L1: 会话记忆（Session Memory）
- **作用**: 当前对话上下文
- **内容**: 最近 N 轮对话、本轮分析过程
- **时效**: 分钟级，会话结束清空

#### L2: 个体记忆（Individual Memory）
- **作用**: 每个 Agent 的成长轨迹
- **内容**:
  - 交易表现统计（胜率、收益）
  - 学习到的市场规律
  - 用户反馈和偏好
- **时效**: 长期，持续累积

#### L3: 群体记忆（Collective Memory）
- **作用**: 所有 Agent 的共享智慧
- **内容**:
  - 市场情绪时间线
  - 集体预测准确率
  - 黑天鹅事件教训
  - 最佳实践提取
- **时效**: 长期 + 持续演化

---

## 与现有框架对比

| 特性 | TradeMind | Vercel AI SDK | Mastra | LangChain |
|------|-----------|---------------|--------|-----------|
| **定位** | 交易专用框架 | 通用 LLM 工具 | 通用 Agent 框架 | 通用 LLM 框架 |
| **多智能体** | ✅ 原生支持 | ❌ 无 | ✅ 支持 | ⚠️ 复杂 |
| **工作流** | ✅ 配置化 | ❌ 无 | ✅ 代码级 | ✅ LCEL |
| **记忆体系** | ✅ 三层记忆 | ❌ 无 | ⚠️ 基础 | ⚠️ 复杂 |
| **交易专用** | ✅ 内置风控 | ❌ 无 | ❌ 无 | ❌ 无 |
| **可控性** | 🔴 完全可控 | 🟡 中等 | 🟡 中等 | 🟡 中等 |
| **学习成本** | 🟢 低（领域专用）| 🟢 低 | 🟡 中 | 🔴 高 |

---

## 影响

### 积极影响
- **产品差异化**: 市场上首个交易专用多智能体框架
- **用户体验**: 非技术用户也能拥有专业交易团队
- **可扩展性**: 未来可通过社交网络协议拓展

### 风险与缓解
- **维护成本**: 需要维护 LLM 接口 → 接口变化慢，风险可控
- **开发周期**: 初期投入大 → 但长期收益高

---

## 后续行动

1. 实现 BaseAgent 核心接口
2. 实现三层记忆系统
3. 创建预设 Agent（技术分析员、Polymarket 专员等）
4. 开发 PA 的 Bull/Bear 推理能力
5. 构建工作流编排系统

---

## 参考

- [product_vision.md](../product/product_vision.md) - 产品愿景
