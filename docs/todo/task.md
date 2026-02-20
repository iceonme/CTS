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

## 额外优化
- [x] 默认步长调整为 720 分钟（12小时）
- [x] DCA 默认定投间隔调整为 10080 分钟（7天）
- [x] 前端日志展示 LLM Prompt 和 Response（可折叠）
- [x] Indicator 级别增加 24h 指标历史数据（RSI/SMA/MACD）

---

## 最终交付物

### 1. 新增文件
- `my-app/lib/skills/tools/analysis-tools.ts` - 分析层 Tools
- `my-app/tests/analysis-tools.spec.ts` - Tools 单元测试
- `my-app/tests/llm-solo-variants.spec.ts` - LLM 变体测试
- `my-app/tests/arena-api.spec.ts` - API 集成测试
- `my-app/tests/contrast-experiment.spec.ts` - 对照实验测试

### 2. 修改文件
- `my-app/lib/skills/index.ts` - 注册 AnalysisTools
- `my-app/lib/agents/contestants/llm-solo-contestant.ts` - 重构支持三种变体
- `my-app/app/api/backtest/run/route.ts` - API 支持 intelligenceLevel 参数
- `my-app/app/arena/page.tsx` - UI 支持三种 LLM 变体、日志展示增强
- `my-app/app/components/backtest/EquityChart.tsx` - Tooltip 修复
- `my-app/lib/core/race-controller.ts` - 传递 positions 数据

### 3. 配置更新
- `.env.local` - MiniMax API Key 配置
- 默认步长：720 分钟
- DCA 间隔：10080 分钟

### 4. 测试结果
**总计 24+ 个测试全部通过 ✓**

---

## 三种 LLM 变体对比

| 特性 | Solo-Lite | Solo-Indicator | Solo-Strategy |
|------|-----------|----------------|---------------|
| 数据输入 | 24h CSV 价格 | 24h CSV + 指标历史 | 12h CSV + 指标 + 日线 |
| RSI 历史 | ❌ | ✅ (24根) | ✅ |
| SMA 历史 | ❌ | ✅ (7/25/50, 24根) | ✅ |
| MACD 历史 | ❌ | ✅ (24根) | ✅ |
| 策略建议 | ❌ | ❌ | ✅ (0-10评分) |
| 结构化推理 | ❌ | ❌ | ✅ |
| Token消耗 | 最低 | 中等 | 最高 |

---

## 状态
**🎉 W2 任务全部完成，已合并到主分支**
