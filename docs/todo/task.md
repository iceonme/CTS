# v0.1 挑战赛 W2：分析层 Tools + LLM 单兵优化

## 阶段一：规划
- [x] 制定实现计划（分析层 Tools + 多变体 LLM Solo）
- [x] 用户审批实现计划

## 阶段二：分析层 Tools 建设
- [x] 设计统一 Tool 接口规范（输入/输出格式）
- [x] 实现 `calculate_rsi` Tool
- [x] 实现 `calculate_ma` Tool
- [x] 实现 `calculate_macd` Tool
- [x] 实现 `get_market_snapshot` 聚合 Tool（一次性返回所有关键指标）
- [x] 验证 Tools 计算结果正确性

## 阶段三：LLM 单兵多变体配置
- [x] 重构 `LLMSoloContestant` 支持配置化（信息量/推理模式可配）
- [x] 实现 Solo-Lite 变体（最少信息）
- [x] 实现 Solo-Indicator 变体（平衡型，含24h指标历史）
- [x] 实现 Solo-Strategy 变体（最多信息 + 多时间框架）
- [x] 设计结构化推理提示词模板

## 阶段四：Arena 集成验证
- [x] Arena API 支持注册多个 LLM Solo 变体
- [x] UI 支持三种 LLM 变体平铺显示（LLM-Lite/Indicator/Strategy）
- [x] 日志系统增强（价格、BTC/USDT仓位、LLM输入输出）
- [x] 图表 Tooltip 修复（显示BTC/USDT数量）
- [x] 跑一轮对照实验
- [x] 🔴 修复代码审查中发现的 Bug (MACD逻辑, ID生成, PnL计算)

---

## 📋 接下来要做 (W3：策略增强与评估)
- [ ] **运行 2025 全年回测**: 获取 Baseline 数据 (DCA vs 三种 LLM 变体)
- [ ] **LLM 策略增强**:
    - [ ] 引入 Few-shot 学习提供优秀交易范例
    - [ ] 增加“决策反思”环节 (Self-Correction)
    - [ ] 优化仓位管理逻辑 (支持 25%/50% 分仓)
- [ ] **评估系统建设**: 实时计算夏普比率、最大回撤、胜率/盈亏比

---

## 历时归档
- [2026-02-20 回测竞技场 Bug 修复](./history/2026-02-20_backtest_bug_fix.md)
