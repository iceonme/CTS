# Arena 选手配置面板（Future - 非紧急）

> **状态**: 📋 规划阶段  
> **优先级**: 低  
> **前置条件**: 需先验证 LLM 交易策略有效性  

---

## 🎯 背景

当前 Arena 的选手配置较为固定，每个 `intelligenceLevel`（Lite/Indicator/Strategy/Scalper）对应固定的数据输入和提示词。

未来需要更灵活的配置系统，支持：
- 基于模板创建自定义选手
- 微调数据输入内容
- 个性化系统提示词
- 保存和复用配置

---

## 🏗️ 架构设计

### 配置分层

```
Arena 比赛配置（全局）
├── 时间跨度：2025-01-01 至 2025-01-07
├── 步长：720分钟（12小时）
└── 参赛选手：[DCA, LLM-Lite-v2, LLM-Scalper-custom, ...]

选手个人配置（独立）
├── 基础模板：Lite / Indicator / Strategy / Scalper
├── 数据内容微调：
│   ├── 时间范围（1h/4h/24h/7d）
│   ├── 具体指标（RSI/SMA/MACD/EMA等）
│   └── 持仓信息粒度
└── 系统提示词：基于模板自定义编辑
```

---

## 📐 UI 设计

### Step 1: 选择基础模板

```
┌─────────────────────────────────────┐
│ 选择基础模板                         │
│                                     │
│ ○ Lite                              │
│   仅价格数据，最简配置                │
│                                     │
│ ● Indicator                         │
│   价格+技术指标(RSI/SMA/MACD)        │
│                                     │
│ ○ Strategy                          │
│   多时间框架+策略评分                 │
│                                     │
│ ○ Scalper                           │
│   波段数据+持仓信息                   │
│                                     │
│ ○ 从已有选手复制...                  │
└─────────────────────────────────────┘
```

### Step 2: 数据内容微调

```
┌─────────────────────────────────────┐
│ 📊 数据内容（基于Indicator模板）      │
│                                     │
│ 时间范围: [ 24小时 ▼ ]               │
│ 选项: 1h / 4h / 24h / 7d            │
│                                     │
│ ☑️ 价格数据（CSV格式）               │
│                                     │
│ ☑️ 技术指标                           │
│   ☑️ RSI(14)                        │
│   ☑️ SMA(7/25/50)                   │
│   ⬜ MACD  ← 可取消勾选              │
│   ⬜ EMA(12/26)                     │
│                                     │
│ ☑️ 指标历史轨迹（24h）               │
│                                     │
│ ⬜ 额外数据                          │
│   ⬜ 持仓成本价                      │
│   ⬜ 24h最高/最低点                  │
└─────────────────────────────────────┘
```

### Step 3: 系统提示词微调

```
┌─────────────────────────────────────┐
│ 📝 系统提示词                        │
│                                     │
│ [基于模板的默认提示词...]            │
│                                     │
│ 微调选项：                           │
│ ○ 使用默认                           │
│ ● 自定义编辑                         │
│                                     │
│ [文本编辑区...]                      │
│ ⚠️ 修改提示词可能影响LLM输出格式     │
│                                     │
│ 保存为: [ My-Indicator-v2 ]          │
└─────────────────────────────────────┘
```

---

## 🔧 技术实现

### 数据类型定义

```typescript
// 选手配置接口
export interface LLMDataConfig {
  timeRange: '1h' | '4h' | '24h' | '7d' | '30d';
  priceData: {
    enabled: boolean;
    fields: ('open' | 'high' | 'low' | 'close' | 'volume')[];
  };
  indicators: {
    rsi?: { enabled: boolean; period: number };
    sma?: { enabled: boolean; periods: number[] };
    ema?: { enabled: boolean; periods: number[] };
    macd?: { enabled: boolean };
  };
  indicatorHistory: boolean;
  positionInfo: {
    enabled: boolean;
    showCost: boolean;
    showPnl: boolean;
    showHistory: boolean;
  };
}

export interface LLMSoloConfig {
  intelligenceLevel: IntelligenceLevel;
  baseTemplate: string;
  dataConfig: LLMDataConfig;
  systemPrompt: {
    mode: 'default' | 'custom';
    content?: string;
  };
  name: string;  // 自定义选手名称
}
```

### 动态 Prompt 构建

```typescript
private async buildPromptWithConfig(
  klines: any[], 
  portfolioState: any,
  config: LLMDataConfig
): Promise<string> {
  let prompt = '';
  
  // 1. 基础信息
  prompt += `【${this.symbol} ${config.timeRange}数据】\n`;
  
  // 2. 价格数据
  if (config.priceData.enabled) {
    prompt += this.buildPriceSection(klines, config.priceData.fields);
  }
  
  // 3. 技术指标
  if (config.indicators.rsi?.enabled) {
    prompt += this.buildRSISection(klines, config.indicators.rsi.period);
  }
  if (config.indicators.sma?.enabled) {
    prompt += this.buildSMASection(klines, config.indicators.sma.periods);
  }
  // ... 其他指标
  
  // 4. 持仓信息
  if (config.positionInfo.enabled) {
    prompt += this.buildPositionSection(portfolioState, config.positionInfo);
  }
  
  return prompt;
}
```

---

## ⚠️ 前置条件

此功能**不应现在实现**，需先满足：

1. **验证 LLM 策略有效性**
   - 至少有一种配置能稳定跑赢 DCA
   - 理解为什么某些配置有效/无效

2. **明确配置变量的影响**
   - 步长对交易频率的影响
   - 指标数量对决策质量的影响
   - 时间范围对趋势判断的影响

3. **积累配置案例**
   - 有 3-5 个有效的自定义配置案例
   - 可作为模板供其他用户参考

---

## 📎 相关文档

- [当前选手实现](../../my-app/lib/agents/contestants/llm-solo-contestant.ts)
- [Arena 页面](../../my-app/app/arena/page.tsx)
- [比赛历史记录](./history/)

---

**创建日期**: 2026-02-20  
**最后更新**: 2026-02-20  
**作者**: TradeMind AI Assistant
