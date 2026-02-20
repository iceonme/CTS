# v0.1 挑战赛 W2：分析层 Tools + LLM 单兵优化

## 状态
**✅ 已完成**

## 目标叙述
本计划旨在通过增强 LLM Solo 选手的感知能力（分析层 Tools）并提供不同信息密度的选手变体，来优化 LLM 在交易竞技场中的表现。实现一套标准化的技术分析工具，并将其集成到 `LLMSoloContestant` 中。

## 提议的变更（已完成）

### 1. 分析层 Tools 增强 [Component: Skills] ✅

#### [NEW] [analysis-tools.ts](file:///c:/Projects/can/my-app/lib/skills/tools/analysis-tools.ts)
- 创建专门的技术指标工具集
- 实现 `calculateRSI`, `calculateSMA`, `calculateEMA`, `calculateMACD` 纯数学计算函数
- 实现 `createAnalysisTools` 服务端 Tool 注册
- ✅ 已交付

#### [MODIFY] [technical-analysis.ts](file:///c:/Projects/can/my-app/lib/skills/technical-analysis.ts)
- 提取的纯数学函数已迁移到 analysis-tools.ts
- 原有 SkillDefinition 保持不变（向后兼容）
- ✅ 已交付

---

### 2. LLMSoloContestant 变体优化 [Component: Agents] ✅

#### [MODIFY] [llm-solo-contestant.ts](file:///c:/Projects/can/my-app/lib/agents/contestants/llm-solo-contestant.ts)
- 支持 `intelligenceLevel`: 'lite' | 'indicator' | 'strategy'
- **Lite**: 24h CSV 价格数据 + 24h涨跌汇总
- **Indicator**: Lite + RSI(14)/SMA(7/25/50)/MACD 当前值 + **24h指标历史数据**
- **Strategy**: Indicator + 日线数据 + 策略建议（评分0-10）
- 重构提示词模板，支持结构化推理（趋势→位置→信号→决策）
- 日志增强：记录价格、BTC/USDT仓位、LLM输入输出
- ✅ 已交付

#### 新增配置接口
```typescript
interface LLMSoloConfig {
    intelligenceLevel?: 'lite' | 'indicator' | 'strategy';
    includeDaily?: boolean;
    customSystemPrompt?: string;
}
```

---

### 3. Arena API 与 UI 联动 [Component: App] ✅

#### [MODIFY] [route.ts](file:///c:/Projects/can/my-app/app/api/backtest/run/route.ts)
- 更新解析逻辑，支持 `intelligenceLevel` 参数
- 支持 MiniMax API Key 环境变量配置
- API Key 缺失时自动降级到 Mock 模式（便于测试）
- 传递 `positions` 数据到前端（用于图表 tooltip）
- ✅ 已交付

#### [MODIFY] [page.tsx](file:///c:/Projects/can/my-app/app/arena/page.tsx)
- 默认显示三种 LLM 变体：LLM-Lite/LLM-Indicator/LLM-Strategy
- 选手配置弹窗增加"情报等级"下拉选择
- 日志面板增强：显示状态更新（价格、仓位）
- 决策日志可折叠展开：查看 LLM Prompt 和 Response
- 默认步长调整为 720 分钟（12小时）
- DCA 默认定投间隔调整为 10080 分钟（7天）
- ✅ 已交付

#### [MODIFY] [EquityChart.tsx](file:///c:/Projects/can/my-app/app/components/backtest/EquityChart.tsx)
- 修复 Tooltip 不消失问题
- Tooltip 显示 BTC 持仓数量和 USDT 余额
- ✅ 已交付

---

## 验证计划（已完成）

### 自动化测试
- ✅ `npm run test tests/analysis-tools.spec.ts` - 9个测试通过
- ✅ `npm run test tests/llm-solo-variants.spec.ts` - 7个测试通过
- ✅ `npm run test tests/arena-api.spec.ts` - 4个测试通过
- ✅ `npm run test tests/contrast-experiment.spec.ts` - 4个测试通过

### 手动验证
1. ✅ 打开 `/arena` 页面，显示三种 LLM 变体
2. ✅ 点击"配置"查看各变体的情报等级选择
3. ✅ 运行回测，实时日志显示价格和仓位
4. ✅ 点击决策日志的"输入 Prompt"查看 LLM 输入
5. ✅ 鼠标移动到图表，Tooltip 显示 BTC/USDT 数量
6. ✅ Indicator 级别日志显示 24h 指标历史

---

## 技术指标说明

### Indicator 级别新增指标历史
```
【指标历史 (CSV)】
T(UTC),P,RSI,SMA7,SMA25,SMA50,MACD_H
01-01 12:00,93450,45,93500,93200,92800,+12
01-01 13:00,93600,48,93600,93300,92900,+25
...
```

每根小时线包含：
- **P**: 收盘价
- **RSI**: RSI(14) 值
- **SMA7/25/50**: 各周期均线
- **MACD_H**: MACD 柱状值

---

## 配置说明

### 环境变量
```bash
MINIMAX_API_KEY=your-api-key
MINIMAX_GROUP_ID=your-group-id  # 可选
```

### 默认参数
| 参数 | 默认值 | 说明 |
|------|--------|------|
| stepMinutes | 720 | 回测步长（12小时） |
| DCA intervalMinutes | 10080 | DCA定投间隔（7天） |
| DCA investAmount | 500 | DCA每次投入金额 |

---

## 变更记录

| 日期 | 变更 | 说明 |
|------|------|------|
| 2026-02-20 | 初始实现 | 完成 Tools + LLM 变体基础框架 |
| 2026-02-20 | UI增强 | 三种变体平铺显示、日志增强 |
| 2026-02-20 | 指标历史 | Indicator 级别增加 24h 指标历史 |
| 2026-02-20 | Tooltip修复 | 图表显示 BTC/USDT 数量 |

---

## 后续建议
1. 运行 7 天真实回测对比三种变体的收益率
2. 统计不同变体的 Token 消耗成本
3. 基于结果调优 Strategy 变体的信号权重
