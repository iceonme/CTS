# CryptoPulse AI: Phase 1 实施计划

> **版本**: v1.0 | **对应 Phase**: Phase 1 (基础设施与单体闭环 MVP)
> **预估工期**: 4-6 周 | **团队规模**: 1-2 人

---

## 1. 项目目录结构

```
cryptopulse-ai/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Dashboard 路由组
│   │   ├── page.tsx              # 首页 - 机会流
│   │   ├── watchlist/
│   │   ├── agents/
│   │   ├── trading/
│   │   └── layout.tsx
│   ├── api/                      # API Routes
│   │   ├── agents/
│   │   ├── signals/
│   │   ├── watchlist/
│   │   ├── trading/
│   │   └── ws/                   # WebSocket handler
│   └── layout.tsx
├── components/                   # React 组件
│   ├── ui/                       # 基础 UI (Button, Card, etc)
│   ├── dashboard/                # Dashboard 相关组件
│   │   ├── OpportunityStream.tsx
│   │   ├── SignalCard.tsx
│   │   ├── PriceTicker.tsx
│   │   └── WatchlistTable.tsx
│   ├── agents/                   # Agent 相关组件
│   │   ├── AgentConfigurator.tsx
│   │   ├── AgentCard.tsx
│   │   └── AgentLogs.tsx
│   └── trading/                  # 交易相关组件
│       ├── PositionList.tsx
│       ├── TradeHistory.tsx
│       └── PortfolioChart.tsx
├── lib/                          # 核心库
│   ├── db/                       # 数据库
│   │   ├── prisma.ts             # Prisma Client
│   │   └── schema.prisma         # Schema 定义
│   ├── ai/                       # AI 相关
│   │   ├── base-agent.ts         # BaseAgent 类
│   │   ├── templates.ts          # Agent 模板定义
│   │   └── memory.ts             # 记忆管理
│   └── utils.ts
├── skills/                       # Skills & Tools
│   ├── coingecko/                # CoinGecko Skill
│   │   ├── index.ts              # Skill 定义
│   │   ├── tools.ts              # Tools 实现
│   │   └── types.ts
│   ├── binance/                  # Binance Skill
│   │   ├── index.ts
│   │   ├── tools.ts
│   │   └── websocket.ts          # WebSocket 管理
│   └── technical/                # 技术分析 Utils
│       ├── indicators.ts         # 指标计算
│       └── patterns.ts           # 形态识别
├── agents/                       # Agent 实例 & 工作流
│   ├── templates/                # 模板定义
│   │   └── tech-analyst.ts
│   ├── workflows/                # 核心工作流
│   │   ├── watchlist-monitor.ts
│   │   ├── opportunity-scout.ts
│   │   ├── anomaly-alert.ts
│   │   └── performance-report.ts
│   └── instances/                # 运行时实例管理
│       └── manager.ts
├── jobs/                         # 后台任务
│   ├── queue.ts                  # Bull 队列配置
│   ├── scheduler.ts              # 定时任务调度
│   └── processors/               # 任务处理器
│       ├── monitor-processor.ts
│       └── scout-processor.ts
├── cli/                          # CLI 工具
│   ├── index.ts                  # 入口
│   └── commands/
│       ├── agent.ts
│       ├── market.ts
│       └── db.ts
├── types/                        # 全局类型定义
│   ├── agent.ts
│   ├── feed.ts
│   ├── signal.ts
│   └── trading.ts
├── docker-compose.yml            # 本地开发环境
├── package.json
└── .env.local.example
```

---

## 2. 核心技术决策详解

### 2.1 BaseAgent 实现

```typescript
// lib/ai/base-agent.ts

import { generateText, streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';

export interface BaseAgentConfig {
  id: string;
  name: string;
  persona: string;
  tools: Record<string, any>;
  llmConfig?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface AgentContext {
  input: string;
  history?: Message[];
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
}

export class BaseAgent {
  private config: BaseAgentConfig;

  constructor(config: BaseAgentConfig) {
    this.config = config;
  }

  async invoke(context: AgentContext): Promise<AgentResponse> {
    const result = await generateText({
      model: openai(this.config.llmConfig?.model || 'gpt-4o-mini'),
      system: this.config.persona,
      messages: this.buildMessages(context),
      tools: this.config.tools,
      temperature: this.config.llmConfig?.temperature ?? 0.7,
    });

    return {
      content: result.text,
      toolCalls: result.toolCalls,
      usage: result.usage,
    };
  }

  async stream(context: AgentContext) {
    return streamText({
      model: openai(this.config.llmConfig?.model || 'gpt-4o-mini'),
      system: this.config.persona,
      messages: this.buildMessages(context),
      tools: this.config.tools,
    });
  }

  private buildMessages(context: AgentContext): Message[] {
    const messages: Message[] = [];
    
    if (context.history) {
      messages.push(...context.history);
    }
    
    messages.push({
      role: 'user',
      content: context.input,
    });
    
    return messages;
  }
}
```

### 2.2 MAS Agent Skill 定义 (符合 Anthropic Skills 标准)

**Anthropic Skills 核心概念**:
- **Tools**: 可执行函数，通过 MCP 暴露 (JSON Schema 定义)
- **Skills**: 封装的领域专业知识 (instructions + templates + references)
- **Agent**: BaseAgent Kernel + Standard Capabilities + Skill 定义

---

#### Tech Analyst Skill (`tech-analyst`) - Phase 1

```typescript
// skills/mas-agents/tech-analyst/skill.ts
// 符合 Anthropic Skills 标准的完整定义

export const TechAnalystSkill: MASAgentSkill = {
  // ========== 元数据 ==========
  id: 'tech-analyst',
  name: '技术分析师',
  description: '专注于技术分析，监控价格形态和技术指标',
  category: 'analyst',
  version: '1.0.0',
  
  // ========== 角色定义 ==========
  role: {
    displayName: 'Alex',
    avatar: '📊',
    title: 'Senior Technical Analyst',
    personality: '理性、数据驱动、谨慎，用数据说话',
    expertise: ['K线形态', '技术指标', '趋势判断', '成交量分析'],
  },
  
  // ========== 核心指令 (Anthropic: instructions) ==========
  instructions: {
    system: `你是 CryptoPulse 的技术分析师 Alex。

👤 你的性格：
- 理性客观，不被情绪左右
- 数据驱动，每个结论都要有指标支撑
- 谨慎保守，宁可错过也不做没有把握的交易

📊 你的专长：
- K线形态识别 (突破、支撑阻力、反转)
- 技术指标分析 (MA、RSI、MACD、成交量)
- 趋势判断与动量分析

🎯 分析框架 (黄金三角 - Side A 价格趋势)：
1. 趋势判断：MA排列、价格相对于MA的位置
2. 动量分析：RSI状态、MACD信号
3. 成交量验证：相对历史均值的变化
4. 关键价位：24h高低点、重要支撑阻力位

⚠️ 你必须遵守的约束：
- 不预测未来价格，只基于已有数据研判
- 每个信号必须有明确的技术指标支撑
- 必须给出置信度和理由
- 趋势不明时给出 "WATCH" 信号而非强行判断`,

    context: '你在 CryptoPulse 系统中工作，接收价格数据，输出交易信号。用户会通过 Dashboard 查看你的分析结果。',
    
    reasoning: `分析流程：
1. 首先判断大趋势 ( bullish/bearish/neutral )
2. 检查动量指标是否有背离或极端值
3. 验证成交量是否配合价格变动
4. 识别关键形态 (突破、金叉/死叉等)
5. 综合以上给出信号和置信度`,

    constraints: [
      '不预测价格，只研判当前状态',
      '必须有指标数据支撑结论',
      '必须输出结构化结果',
      '置信度低于0.6时输出WATCH',
    ],
  },
  
  // ========== 决策框架 (Anthropic: templates) ==========
  decisionFramework: {
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: '币种符号' },
        timeframe: { type: 'string', enum: ['15m', '1h', '4h', '1d'] },
        priceData: { type: 'object' },
        indicators: { type: 'object' },
      },
      required: ['symbol', 'priceData'],
    },
    
    analysisSteps: [
      { step: 1, name: '趋势判断', description: '基于MA判断趋势方向', tools: ['technical:calculate_ma'], outputKey: 'trend' },
      { step: 2, name: '动量分析', description: 'RSI、MACD状态', tools: ['technical:calculate_rsi', 'technical:calculate_macd'], outputKey: 'momentum' },
      { step: 3, name: '成交量验证', description: '成交量是否配合', outputKey: 'volume' },
      { step: 4, name: '形态识别', description: '突破、金叉等形态', tools: ['technical:detect_patterns'], outputKey: 'patterns' },
      { step: 5, name: '综合研判', description: '整合所有因素输出信号', outputKey: 'signal' },
    ],
    
    outputSchema: {
      type: 'object',
      properties: {
        signal: { type: 'string', enum: ['LONG', 'SHORT', 'HOLD', 'WATCH'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string', description: '简洁的核心理由' },
        suggestedPosition: { type: 'string', description: '建议仓位如"10%"或"观望"' },
        keyIndicators: {
          type: 'object',
          properties: {
            trend: { type: 'string' },
            momentum: { type: 'string' },
            volume: { type: 'string' },
          },
        },
        riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
      },
      required: ['signal', 'confidence', 'reasoning'],
    },
  },
  
  // ========== 工具配置 (Anthropic: MCP Tools) ==========
  tools: {
    required: [
      'coingecko:get_price',
      'binance:get_klines',
      'technical:calculate_rsi',
      'technical:calculate_ma',
    ],
    optional: [
      'technical:calculate_macd',
      'technical:detect_patterns',
      'technical:calculate_volume_profile',
    ],
    preferences: {
      'binance:get_klines': { priority: 1, fallback: 'coingecko:get_market_chart' },
    },
  },
  
  // ========== 触发规则 ==========
  triggers: [
    { type: 'cron', schedule: '*/15 * * * *', timezone: 'UTC' },
  ],
  
  // ========== 参考资料 (Anthropic: reference materials) ==========
  references: {
    examples: [
      {
        input: { symbol: 'BTC', priceData: { price: 45000, change24h: 2.5 }, indicators: { rsi: 65, ma7: 44500, ma25: 44000 } },
        output: { signal: 'LONG', confidence: 0.75, reasoning: 'MA7上穿MA25形成金叉，RSI 65处于健康区间，价格站稳均线之上', suggestedPosition: '15%' },
        explanation: '多头排列 + RSI健康 = 看涨信号',
      },
      {
        input: { symbol: 'ETH', priceData: { price: 3000, change24h: -0.5 }, indicators: { rsi: 45, ma7: 3050, ma25: 3100 } },
        output: { signal: 'WATCH', confidence: 0.5, reasoning: '价格在MA下方运行，趋势偏弱但RSI未超卖，建议观望', suggestedPosition: '观望' },
        explanation: '趋势向下但未到极端，等待明确信号',
      },
    ],
    templates: {
      bullishAnalysis: '从技术指标看，{symbol} 呈现积极信号：{indicators}。综合判断建议 {action}。',
      bearishAnalysis: '{symbol} 技术面显示压力：{indicators}。建议 {action} 控制风险。',
      neutralAnalysis: '{symbol} 目前处于震荡整理阶段，关键指标：{indicators}。建议观望等待明确方向。',
    },
    docs: [
      { title: 'MA 金叉/死叉识别指南', content: '...', category: 'strategy' },
      { title: 'RSI 超买超卖使用说明', content: '...', category: 'strategy' },
      { title: '成交量验证原则', content: '...', category: 'strategy' },
    ],
  },
  
  // ========== 标准能力配置 ==========
  capabilities: {
    memory: { enabled: true, scope: 'task' },
    ruleEngine: { enabled: true, rules: ['rsi_threshold', 'ma_cross', 'volume_spike'] },
    communication: { enabled: true, channels: ['war-room', 'signals'] },
  },
};
```

#### CFO Skill (`cfo`) - Phase 1

```typescript
// skills/mas-agents/cfo/skill.ts

export const CFOSkill: MASAgentSkill = {
  id: 'cfo',
  name: '首席财务官',
  description: '资金管理、风险控制、最终决策执行',
  category: 'strategist',
  version: '1.0.0',
  
  role: {
    displayName: 'Victor',
    avatar: '👔',
    title: 'Chief Financial Officer',
    personality: '稳重、全局观、风险控制优先',
    expertise: ['资金管理', '风险控制', '仓位管理', '投资组合优化'],
  },
  
  instructions: {
    system: `你是 CryptoPulse 的 CFO Victor。

👤 你的性格：
- 稳重保守，把资金安全放在第一位
- 全局思维，考虑整个投资组合的平衡
- 纪律严明，严格遵守风险控制规则

💼 你的职责：
1. 评估 Analyst 提交的交易信号质量
2. 结合当前仓位和风险状况做最终决策
3. 决定具体执行方案 (买多少、什么价位)
4. 确保整体风险可控

🎯 决策框架：
1. 信号质量评估：置信度、理由充分性、技术分析合理性
2. 仓位检查：当前仓位、资金利用率、集中度
3. 风险评估：单笔风险、组合风险、最坏情况
4. 资金分配：根据信号质量和风险决定仓位

⚠️ 风险控制原则 (必须遵守)：
- 单一币种不超过总资金 30%
- 单笔交易最大亏损不超过本金 5%
- 趋势不明或信号质量不高时宁可错过
- 满仓时必须有明确的减仓计划`,

    context: '你接收来自 Analyst 的交易信号，结合账户状况输出最终决策。',
    
    reasoning: `决策流程：
1. 评估信号：检查置信度和理由
2. 检查仓位：是否有足够资金，当前该币种仓位
3. 计算风险：如果执行，最大可能亏损
4. 做出决策：EXECUTE(执行)/MODIFY(修改)/REJECT(驳回)/HOLD(暂缓)
5. 制定执行计划：具体买入/卖出方案`,

    constraints: [
      '单一币种 ≤ 30% 仓位',
      '单笔风险 ≤ 5% 本金',
      '必须输出明确的执行方案',
      '拒绝信号时必须说明理由',
    ],
  },
  
  decisionFramework: {
    inputSchema: {
      type: 'object',
      properties: {
        signal: { type: 'object', description: 'Analyst 提交的信号' },
        portfolio: { type: 'object', description: '当前投资组合状态' },
        marketCondition: { type: 'object', description: '市场环境' },
      },
      required: ['signal', 'portfolio'],
    },
    analysisSteps: [
      { step: 1, name: '信号质量评估', description: '检查置信度和理由', outputKey: 'signalQuality' },
      { step: 2, name: '仓位检查', description: '当前仓位和资金情况', tools: ['portfolio:get_positions'], outputKey: 'positionStatus' },
      { step: 3, name: '风险评估', description: '计算潜在风险', tools: ['portfolio:calculate_risk'], outputKey: 'riskAssessment' },
      { step: 4, name: '决策输出', description: 'EXECUTE/MODIFY/REJECT/HOLD', outputKey: 'decision' },
      { step: 5, name: '执行计划', description: '具体执行方案', outputKey: 'executionPlan' },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        decision: { type: 'string', enum: ['EXECUTE', 'MODIFY', 'REJECT', 'HOLD'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' },
        executionPlan: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['BUY', 'SELL', 'HOLD'] },
            symbol: { type: 'string' },
            amount: { type: 'string', description: '数量或比例' },
            priceRange: { type: 'string', description: '建议价格区间' },
          },
        },
        riskAssessment: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
      },
      required: ['decision', 'confidence', 'reasoning'],
    },
  },
  
  tools: {
    required: [
      'portfolio:get_balance',
      'portfolio:get_positions',
      'portfolio:calculate_risk',
    ],
    optional: [
      'trading:simulate_order',
      'portfolio:get_history',
    ],
  },
  
  triggers: [
    { type: 'signal', source: 'analyst', filter: 'confidence >= 0.6' },
  ],
  
  references: {
    examples: [
      {
        input: { signal: { symbol: 'BTC', signal: 'LONG', confidence: 0.8 }, portfolio: { balance: 10000, positions: { BTC: { value: 2000 } } } },
        output: { decision: 'EXECUTE', confidence: 0.85, executionPlan: { action: 'BUY', symbol: 'BTC', amount: '15%', priceRange: '市价' }, riskAssessment: 'MEDIUM' },
        explanation: '高置信度信号 + 仓位不重 = 执行',
      },
    ],
    templates: {
      executeDecision: '决定执行该信号。原因：{reasons}。执行方案：{plan}。',
      modifyDecision: '决定修改后执行。原因：{reasons}。修改内容：{modifications}。',
      rejectDecision: '决定驳回该信号。原因：{reasons}。',
      holdDecision: '决定暂缓执行。原因：{reasons}。条件：{conditions}。',
    },
  },
  
  capabilities: {
    memory: { enabled: true, scope: 'persistent' },
    ruleEngine: { enabled: true, rules: ['position_limit', 'risk_limit', 'concentration_check'] },
    communication: { enabled: true, channels: ['war-room', 'execution', 'alerts'] },
  },
};
```

#### Bull & Bear Skills - Phase 2

```typescript
// 辩论型 Agent 使用相同的 Skill 结构
// 主要差异在 instructions.reasoning (辩论逻辑) 和 outputSchema

export const BullStrategistSkill: MASAgentSkill = {
  id: 'bull-strategist',
  // ... 结构同上
  instructions: {
    system: '你是看涨策略师 Ben...',
    reasoning: '辩论流程：1)寻找看涨论据 2)反驳Bear观点 3)机会成本分析',
  },
  decisionFramework: {
    outputSchema: {
      stance: 'BULLISH',
      confidence: 0-1,
      keyArguments: [],
      counterToBear: '',
      suggestedAction: '',
    },
  },
};

export const BearStrategistSkill: MASAgentSkill = {
  id: 'bear-strategist',
  // ... 结构同上
  instructions: {
    system: '你是看空策略师 Barry...',
    reasoning: '辩论流程：1)识别风险点 2)质疑Bull假设 3)保护策略',
  },
  decisionFramework: {
    outputSchema: {
      stance: 'BEARISH',
      confidence: 0-1,
      keyRisks: [],
      counterToBull: '',
      warningLevel: '',
    },
  },
};
```
```

### 2.3 Skill 封装示例

```typescript
// skills/coingecko/index.ts

import { tool } from 'ai';
import { z } from 'zod';

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

export const CoinGeckoSkill = {
  name: 'coingecko',
  description: 'CoinGecko 加密货币行情数据源',
  
  tools: {
    get_price: tool({
      description: '获取指定币种的当前价格',
      parameters: z.object({
        coinId: z.string().describe('CoinGecko coin ID, e.g., bitcoin'),
        vsCurrency: z.string().default('usd').describe('计价货币'),
      }),
      execute: async ({ coinId, vsCurrency }) => {
        const res = await fetch(
          `${COINGECKO_API_BASE}/simple/price?ids=${coinId}&vs_currencies=${vsCurrency}&include_24hr_change=true&include_24hr_vol=true`
        );
        return res.json();
      },
    }),

    get_market_chart: tool({
      description: '获取历史市场数据（价格、成交量、市值）',
      parameters: z.object({
        coinId: z.string(),
        days: z.number().describe('天数: 1, 7, 30, 90, 365'),
        vsCurrency: z.string().default('usd'),
      }),
      execute: async ({ coinId, days, vsCurrency }) => {
        const res = await fetch(
          `${COINGECKO_API_BASE}/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${days}`
        );
        return res.json();
      },
    }),

    search_coins: tool({
      description: '搜索币种',
      parameters: z.object({
        query: z.string().describe('搜索关键词'),
      }),
      execute: async ({ query }) => {
        const res = await fetch(
          `${COINGECKO_API_BASE}/search?query=${encodeURIComponent(query)}`
        );
        return res.json();
      },
    }),
  },
};
```

### 2.4 规则引擎 + LLM 混合模式

```typescript
// agents/workflows/watchlist-monitor.ts

export async function runWatchlistMonitor(agentInstance: AgentInstance) {
  const { symbols } = agentInstance.config.parameters;
  
  for (const symbol of symbols) {
    // 步骤 1: 规则引擎初筛 (硬计算)
    const technicalData = await fetchTechnicalData(symbol);
    const ruleBasedSignal = runRuleEngine(technicalData);
    
    // 如果不符合任何规则，跳过
    if (!ruleBasedSignal) continue;
    
    // 步骤 2: LLM 综合研判
    const agent = new BaseAgent({
      id: agentInstance.id,
      name: agentInstance.name,
      persona: agentInstance.config.persona,
      tools: { ...CoinGeckoSkill.tools, ...TechnicalSkill.tools },
    });
    
    const context: AgentContext = {
      input: `基于以下技术数据，判断是否生成交易信号：

币种: ${symbol}
规则引擎初筛结果: ${JSON.stringify(ruleBasedSignal)}
技术指标: ${JSON.stringify(technicalData)}

请输出结构化分析：`,
      metadata: { symbol, technicalData },
    };
    
    const response = await agent.invoke(context);
    
    // 步骤 3: 解析并存储 Signal
    const signal = parseSignal(response.content);
    if (signal && signal.confidence > 0.6) {
      await saveSignal({
        ...signal,
        topic: symbol,
        publisher: {
          id: agentInstance.id,
          name: agentInstance.name,
          role: 'Analyst',
        },
        timestamp: Date.now(),
      });
      
      // 推送实时通知
      await broadcastSignal(signal);
    }
  }
}

// 规则引擎实现
function runRuleEngine(data: TechnicalData): RuleSignal | null {
  const signals: string[] = [];
  
  // RSI 超卖/超买
  if (data.rsi < 30) signals.push('RSI_OVERSOLD');
  if (data.rsi > 70) signals.push('RSI_OVERBOUGHT');
  
  // MA 金叉/死叉
  if (data.ma7 > data.ma25 && data.prevMa7 <= data.prevMa25) {
    signals.push('MA_GOLDEN_CROSS');
  }
  
  // 突破 24h 高点
  if (data.price > data.high24h * 0.99) {
    signals.push('BREAKOUT_24H_HIGH');
  }
  
  // 成交量异常
  if (data.volume > data.avgVolume1h * 3) {
    signals.push('VOLUME_SPIKE');
  }
  
  return signals.length > 0 ? { signals, data } : null;
}
```

---

## 3. 数据库 Schema (Prisma)

```prisma
// lib/db/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 用户
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  watchlists  Watchlist[]
  agents      AgentInstance[]
  portfolio   Portfolio?
}

// 关注列表
model Watchlist {
  id        String   @id @default(uuid())
  userId    String
  name      String
  createdAt DateTime @default(now())

  user  User            @relation(fields: [userId], references: [id])
  items WatchlistItem[]
}

model WatchlistItem {
  id            String @id @default(uuid())
  watchlistId   String
  symbol        String // e.g., BTC
  coinGeckoId   String // e.g., bitcoin
  addedAt       DateTime @default(now())
  alertSettings Json?    // 自定义提醒设置

  watchlist Watchlist @relation(fields: [watchlistId], references: [id], onDelete: Cascade)
}

// Agent 模板
model AgentTemplate {
  id          String   @id @default(cuid())
  name        String
  description String
  category    String   // analyst, strategist, custom
  config      Json     // 完整配置 JSON
  version     String   @default("1.0")
  isSystem    Boolean  @default(false)
  createdAt   DateTime @default(now())

  instances AgentInstance[]
}

// Agent 实例
model AgentInstance {
  id         String @id @default(cuid())
  userId     String
  templateId String
  name       String
  config     Json   // 实例化后的配置
  status     String @default("active") // active, paused, error
  lastRunAt  DateTime?
  createdAt  DateTime @default(now())

  user     User          @relation(fields: [userId], references: [id])
  template AgentTemplate @relation(fields: [templateId], references: [id])
  signals  Signal[]
}

// 信号/Feed
model Signal {
  id          String   @id @default(cuid())
  topic       String   // e.g., BTC/USDT
  agentId     String
  signalType  String   // LONG, SHORT, NEUTRAL, WATCH
  confidence  Float
  reasoning   String   @db.Text
  metadata    Json?    // 指标快照等
  executed    Boolean  @default(false)
  executedAt  DateTime?
  createdAt   DateTime @default(now())

  agent AgentInstance @relation(fields: [agentId], references: [id])
}

// 模拟交易
model Portfolio {
  id          String   @id @default(cuid())
  userId      String   @unique
  balanceUsdt Float    @default(10000) // 初始资金
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user     User       @relation(fields: [userId], references: [id])
  positions Position[]
  trades    Trade[]
}

model Position {
  id          String  @id @default(cuid())
  portfolioId String
  symbol      String
  side        String  // LONG, SHORT
  quantity    Float
  avgPrice    Float
  unrealizedPnl Float @default(0)
  openedAt    DateTime @default(now())

  portfolio Portfolio @relation(fields: [portfolioId], references: [id])
}

model Trade {
  id          String   @id @default(cuid())
  portfolioId String
  symbol      String
  side        String   // BUY, SELL
  quantity    Float
  price       Float
  total       Float
  signalId    String?  // 关联的信号
  createdAt   DateTime @default(now())

  portfolio Portfolio @relation(fields: [portfolioId], references: [id])
}
```

---

## 4. 开发里程碑

### Week 1: 骨架搭建
- [ ] 项目初始化 (Next.js + TypeScript)
- [ ] Prisma + PostgreSQL + Redis 配置
- [ ] 基础 UI 组件 (Shadcn/ui)
- [ ] Docker Compose 开发环境

### Week 2: Agent 内核 & MAS 成员设计
- [ ] BaseAgent 类实现
- [ ] Vercel AI SDK 集成
- [ ] Agent 模板系统设计
- [ ] **Tech Analyst (Alex)** 完整设计 + 实现
- [ ] **CFO (Victor)** 完整设计 + 实现

### Week 3: 数据源 & 工作流
- [ ] CoinGecko Skill 封装
- [ ] Binance Skill 封装
- [ ] 技术指标计算 (RSI/MA)
- [ ] Watchlist Monitor 实现

### Week 4: 异动检测 & 通知
- [ ] Anomaly Alert (Polling 机制)
- [ ] Opportunity Scout
- [ ] SSE 推送结果 (非 WebSocket)
- [ ] Signal 存储 & 展示
- [ ] 研判过程可视化组件

### Week 5: 交易 & UI
- [ ] 模拟账户系统
- [ ] CFO Agent (简化版)
- [ ] Dashboard 页面
- [ ] Watchlist 管理

### Week 6: 完善 & 部署
- [ ] CLI 工具
- [ ] 性能报告
- [ ] 文档完善
- [ ] 本地部署测试

---

## 5. 环境变量配置

```bash
# .env.local

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/cryptopulse"

# Redis
REDIS_URL="redis://localhost:6379"

# AI Provider (OpenAI)
OPENAI_API_KEY="sk-..."

# CoinGecko (Free tier 无需 API Key，Pro 需要)
COINGECKO_API_KEY=""

# Binance (读取数据无需 Key，交易需要)
BINANCE_API_KEY=""
BINANCE_SECRET_KEY=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
APP_SECRET="your-secret-key"
```

---

## 6. 本地开发启动

```bash
# 1. 启动基础设施
docker-compose up -d

# 2. 安装依赖
npm install

# 3. 数据库迁移
npx prisma migrate dev
npx prisma generate

# 4. 启动开发服务器
npm run dev

# 5. 启动 Worker (后台任务)
npm run worker
```

---

## 7. 风险与应对

| 风险 | 可能性 | 应对方案 |
|------|--------|----------|
| CoinGecko API 限流 | 中 | 实现请求队列 + 缓存 + 降级到 Binance |
| LLM 调用成本高 | 中 | 规则引擎先过滤，减少 LLM 调用次数 |
| Polling 频率设置不当 | 中 | 用户可配置频率，默认保守 (15分钟) |
| 指标计算性能差 | 低 | 使用轻量级 JS 库，数据量不大 |
| Agent 研判质量不稳定 | 中 | 规则引擎兜底 + 用户反馈调优 Prompt |

---

## 8. 关键确认点

在开始前，请确认以下决策:

| 决策项 | 当前方案 | 需要你确认 |
|--------|----------|------------|
| **研判频率** | 盯盘: 15分钟 / 找机会: 12小时 / 异动: 5分钟轮询 | 是否符合预期? |
| **自主性默认** | 确认模式 (Agent 建议 → 用户确认) | OK? |
| **War Room 形象** | 专业商务风 vs 卡通风? | 你定 |
| **Phase 1 币种** | BTC, ETH, DOGE 起步 | OK? |

## 9. 下一步行动

1. **确认上述决策**
2. **准备开发环境**: 安装 Docker、Node.js
3. **初始化项目**: 创建 Next.js 项目，提交初始 commit
4. **Week 1 Kickoff**: 开始骨架搭建

有任何问题或需要调整的地方，随时讨论！
