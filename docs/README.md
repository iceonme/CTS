# TradeMind 文档中心

> **TradeMind** - 你的交易智能体小队

---

## 🚨 快速开始

**如果你是新加入的开发者，从这里开始：**

1. 阅读 [产品愿景](./product/product_vision.md) - 理解我们在做什么
2. 阅读 [架构决策 ADR-001](./architecture/ADR-001-agent-framework.md) - 理解技术架构
3. 阅读 [项目交接文档](../HANDOVER.md) - 了解当前状态和下一步任务

---

## 📚 文档导航

### 🎯 必读文档（最新）
| 文档 | 说明 | 状态 |
|------|------|------|
| [product/product_vision.md](./product/product_vision.md) | 产品愿景与路线图 | ✅ 最新 |
| [architecture/ADR-001-agent-framework.md](./architecture/ADR-001-agent-framework.md) | Agent 框架架构决策 | ✅ 最新 |
| [../HANDOVER.md](../HANDOVER.md) | 项目交接与下一步任务 | ✅ 最新 |

### 📖 历史参考文档（部分过时）
| 文档 | 说明 | 状态 |
|------|------|------|
| [mvp_functional.md](./mvp_functional.md) | MVP 功能清单 | ⚠️ CFO 已更名为 PA（小队队长） |
| [implementation_plan.md](./implementation_plan.md) | 实施计划 | ⚠️ 技术栈已更新 |
| [system_design.md](./system_design.md) | 原始架构设计 | ⚠️ 架构已演进至 v2.0 |

---

## 🗂️ 文档结构

```
docs/
├── README.md                          # 本文档（导航中心）
├── architecture/                      # 架构设计
│   └── ADR-001-agent-framework.md     # Agent 框架设计（最新）
├── product/                           # 产品文档
│   └── product_vision.md              # 产品愿景（最新）
├── mvp_functional.md                  # MVP 功能（历史参考）
├── implementation_plan.md             # 实施计划（历史参考）
└── system_design.md                   # 原始架构（历史参考）
```

---

## 🆕 最近更新

### 2026-02-17 重大架构升级

**从 CryptoPulse AI 升级为 TradeMind Framework**

**关键变更**:
- ✅ **CFO → PA**: 统一命名为 Squad Leader（交易智能体小队队长）
- ✅ **自研框架**: 不再依赖外部 AI 框架，自研 TradeMind Agent 框架
- ✅ **三层记忆**: 引入会话/个体/群体三层记忆系统
- ✅ **产品定位**: 面向非技术用户的"交易智能体小队"
- ✅ **未来愿景**: Phase 3 交易社交网络

**已删除文档**:
- `handoff.md` - 被 HANDOVER.md 覆盖
- `task.md` - 任务列表过时
- `ui_design.md` - UI 已实现

---

## 🏃 快速恢复开发

```bash
# 1. 进入项目
cd my-app

# 2. 安装依赖
npm install

# 3. 启动开发
npm run dev

# 4. 运行测试
npx playwright test
```

---

## 📝 文档维护指南

### 创建新文档
1. 架构决策 → `docs/architecture/ADR-XXX-名称.md`
2. 产品文档 → `docs/product/名称.md`
3. 更新本文档导航

### 标记过时文档
在文档头部添加：
```markdown
---
⚠️ 状态: 部分过时
⚠️ 更新日期: YYYY-MM-DD
⚠️ 说明: 变更说明
⚠️ 最新参考: 参见 xxx.md
---
```

---

**TradeMind 团队**  
*让每个人都能拥有专业的交易智能体小队*
