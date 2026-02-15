# CryptoPulse AI: 系统架构与需求说明书

> **版本**: v1.4 | **最后更新**: 2026-02-15

---

## 1. 核心愿景

构建一个**"不知疲倦的智能盯盘助手"**。

**CFO (Personal Assistant)** 是用户的核心接口，像一位专业的投资顾问：
- **主动工作**: 定时执行盯盘、找机会、异动监控、报告生成
- **内心独白**: 通过 Bull/Bear 推理模式进行"天人交战"
- **专业求证**: 必要时调用具体情报员验证数据
- **最终决策**: 综合所有信息后给出明确建议

---

## 2. 架构设计

### 2.1 CFO (PA) 工作机制

**CFO 是主动工作的 Agent**，按以下四种模式运行：

```
┌──────────────────────────────────────────────────────────────┐
│                    CFO (Personal Assistant)                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  【1. 盯盘】定时触发: 每 5-15 分钟                            │
│      ├─ 扫描关注列表                                         │
│      ├─ 读取技术分析 Feed                                    │
│      ├─ 内心独白 (Bull vs Bear)                              │
│      └─ 给出持仓/买卖建议                                    │
│                                                              │
│  【2. 找机会】定时触发: 每 12 小时                            │
│      ├─ 全市场扫描                                           │
│      ├─ 读取各方情报                                         │
│      ├─ 内心独白 (机会 vs 风险)                              │
│      └─ 推荐潜力币种                                         │
│                                                              │
│  【3. 异动提醒】事件触发: 检测到异动                          │
│      ├─ 立即读取相关情报                                     │
│      ├─ 快速内心独白                                         │
│      └─ 实时推送速报                                         │
│                                                              │
│  【4. 操作报告】定时触发: 每 12 小时                          │
│      ├─ 回顾交易记录                                         │
│      ├─ 市场复盘                                             │
│      └─ 生成报告并与用户对话                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 内心独白机制 (类似 ReAct CoT)

CFO 在做决策时，内部采用 **Bull/Bear 推理模式** 进行"天人交战"：

```
CFO 决策流程:

[输入] 市场数据 + 情报 Feed
    ↓
[Thought 1] Bull 推理模式
    "从看多角度，这个信号意味着..."
    输出: {观点, 论据, 置信度}
    ↓
[Thought 2] Bear 推理模式  
    "从看空角度，需要注意的风险是..."
    输出: {观点, 论据, 置信度}
    ↓
[Thought 3] 数据验证 (可选)
    "我需要向技术情报员确认..."
    调用具体情报员 Tool
    ↓
[Thought 4] 综合判断
    "综合 Bull/Bear 观点，考虑当前仓位..."
    输出: {最终决策, 理由, 行动方案}
    ↓
[Action] 执行或汇报
    如: "建议买入 BTC 10% 仓位，理由是..."
```

**Bull/Bear 推理模式**:
- 不是独立 Agent，是 CFO 内部的**推理子程序**
- 类似 ReAct 中的 "Thought" 步骤
- 使用不同的 system prompt 切换视角
- **关键**: 每次推理都要记录观点，用于统计正确率

### 2.3 正确率统计与市场牛熊指标

```
每次 CFO 使用 Bull/Bear 模式后，记录:

{
  timestamp: 1234567890,
  symbol: "BTC",
  bullView: {
    opinion: "看涨",
    reasoning: "...",
    confidence: 0.8
  },
  bearView: {
    opinion: "观望", 
    reasoning: "...",
    confidence: 0.6
  },
  cfoDecision: "买入",
  
  // 后续验证 (1-3天后)
  outcome: {
    priceChange: "+5%",
    bullWasRight: true,   // 看多观点是否正确
    bearWasRight: false   // 看空观点是否正确
  }
}

统计指标:
- Bull 正确率 = Bull正确次数 / Bull总次数
- Bear 正确率 = Bear正确次数 / Bear总次数

市场牛熊判断:
- Bull正确率 > 70% → 可能处于牛市
- Bear正确率 > 70% → 可能处于熊市
- 两者接近 → 震荡市
```

### 2.4 专业求证机制

当 CFO 需要验证数据时，可以**调用具体情报员**：

```
CFO: "我需要确认 BTC 的技术面细节"
    ↓
调用 Tool: query_intelligence_agent
    {
      agent: "tech-analysis-agent",
      query: "BTC 的 RSI 和成交量情况",
      timeframe: "4h"
    }
    ↓
技术情报员返回详细分析
    ↓
CFO 继续内心独白决策
```

**情报员列表**:
| 情报员 | 能力 | 用途 |
|--------|------|------|
| 技术分析情报员 | 指标、形态 | 技术面验证 |
| 巨鲸监控情报员 | 链上资金 | 资金面验证 |
| 舆情分析情报员 | 社媒情绪 | 情绪面验证 |
| 预测市场情报员 | 事件概率 | 事件面验证 |

### 2.5 组织架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    用户 (You)                               │
│                      ↑↓                                     │
│                唯一对话接口                                  │
├─────────────────────────────────────────────────────────────┤
│                   CFO (PA)                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 主动任务执行                                         │   │
│  │ • 盯盘 (5-15分钟)                                    │   │
│  │ • 找机会 (12小时)                                    │   │
│  │ • 异动监控 (事件)                                    │   │
│  │ • 报告生成 (12小时)                                  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 内心独白 (ReAct CoT)                                 │   │
│  │ ┌──────────┐    ┌──────────┐                       │   │
│  │ │ Bull模式 │ vs │ Bear模式 │ → 记录 + 统计         │   │
│  │ └──────────┘    └──────────┘                       │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 专业求证                                             │   │
│  │ • 调用情报员验证数据                                 │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 最终决策                                             │   │
│  │ • 综合判断 → 行动                                    │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                   情报员网络 (按需调用)                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │ 技术    │ │ 巨鲸    │ │ 舆情    │ │ 预测    │         │
│  │ 分析    │ │ 监控    │ │ 分析    │ │ 市场    │         │
│  │ 📊      │ │ 🐋      │ │ 📰      │ │ 🎯      │         │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. CFO Skill 定义

```typescript
interface CFOSkill {
  id: "cfo";
  name: "CFO (Personal Assistant)";
  avatar: "👔";
  
  // 核心能力
  capabilities: {
    // 主动任务
    activeTasks: [
      { name: "watchlist_monitor", schedule: "*/15 * * * *" },
      { name: "opportunity_scout", schedule: "0 */12 * * *" },
      { name: "anomaly_alert", trigger: "event_based" },
      { name: "performance_report", schedule: "0 */12 * * *" }
    ];
    
    // 推理模式
    reasoningModes: ["bull", "bear", "neutral"];
    
    // 外部调用
    canQueryAgents: string[];  // 可调用的情报员
    canExecuteTrade: boolean;  // 可执行交易
    canCommunicateWithUser: boolean;  // 可与用户对话
  };
  
  // 推理框架 (ReAct CoT 风格)
  reasoningFramework: {
    steps: [
      { type: "collect_data", description: "收集相关情报" },
      { type: "bull_perspective", description: "Bull视角分析" },
      { type: "bear_perspective", description: "Bear视角分析" },
      { type: "verify_data", description: "数据验证(可选)", optional: true },
      { type: "synthesize", description: "综合判断" },
      { type: "decide", description: "最终决策" }
    ];
    
    // 观点记录
    recordOpinions: true;
    trackAccuracy: true;
  };
  
  // 决策输出
  outputSchema: {
    decision: "buy" | "sell" | "hold" | "watch";
    confidence: number;
    reasoning: string;
    bullView: { opinion: string; confidence: number };
    bearView: { opinion: string; confidence: number };
    action?: {
      symbol: string;
      side: "buy" | "sell";
      amount: string;
    };
  };
}
```

---

## 4. 工作流程示例

### 示例：盯盘任务执行流程

```
[定时触发: 15:30]
CFO 开始执行 "盯盘" 任务

Step 1: 数据收集
    CFO 读取 Watchlist: [BTC, ETH, DOGE]
    CFO 读取最新 Feed:
      - 技术情报员: BTC 突破 24h 高点
      - 巨鲸情报员: 检测到 500 BTC 流入交易所

Step 2: Bull 推理 (内心独白)
    Prompt: "假设你是看多者，如何看待这些信号？"
    Output: {
      opinion: "强烈看涨",
      reasoning: "技术面突破 + 资金流入，典型上涨信号",
      confidence: 0.85
    }
    [记录观点到数据库]

Step 3: Bear 推理 (内心独白)
    Prompt: "假设你是看空者，有哪些风险？"
    Output: {
      opinion: "谨慎",
      reasoning: "突破未放量，可能是假突破",
      confidence: 0.6
    }
    [记录观点到数据库]

Step 4: 数据验证 (可选)
    CFO: "我需要确认成交量数据"
    → 调用技术情报员 Tool
    ← 返回: "成交量确实放大 150%"

Step 5: 综合判断
    CFO 思考:
    - Bull 置信度高 (0.85) 且有数据支撑
    - Bear 置信度一般 (0.6) 且被证伪
    - 当前 BTC 仓位: 20% (未超仓)
    - 结论: 建议加仓

Step 6: 输出决策
    {
      decision: "buy",
      symbol: "BTC",
      amount: "10%",
      reasoning: "技术面突破+资金验证，Bull观点占优",
      bullView: {...},
      bearView: {...}
    }

Step 7: 与用户对话
    CFO → 用户: "老板，BTC 出现突破信号，技术面和资金面都配合，
               建议买入 10% 仓位，您看如何？"
```

---

## 5. 技术栈

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **AI Engine**: Vercel AI SDK
- **Database**: PostgreSQL
- **Cache**: Redis
- **Queue**: Bull (定时任务)

---

## 6. 产品路线图

### Phase 1: CFO MVP (4-6 周)
- CFO 核心框架 (主动任务 + Bull/Bear 推理)
- 技术分析情报员
- 盯盘/找机会/异动/报告 四种任务
- 基础正确率统计

### Phase 2: 完整 MAS (4-6 周)
- 扩展情报员 (巨鲸、舆情、预测市场)
- 完善正确率统计与牛熊指标
- War Room 可视化

### Phase 3: 生态化
- 更多情报员类型
- 长期记忆优化
- SaaS 部署
