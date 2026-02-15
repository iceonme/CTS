# CryptoPulse AI: 任务清单 (Tasklist)

> **版本**: v1.4 | **架构**: CFO (PA) + Bull/Bear 推理模式 + 情报员网络

---

## Phase 1: CFO MVP - [/]

> **目标**: 实现主动工作的 CFO，内置 Bull/Bear 推理模式，可调用技术情报员

### 1.1 基础设施 [/]

- [ ] **项目初始化**
    - [ ] Next.js 14+ (App Router, TypeScript)
    - [ ] 目录结构: `/app`, `/lib`, `/skills`, `/agents`, `/components`
    - [ ] Prisma + PostgreSQL + Redis

- [ ] **核心依赖**
    - [ ] Vercel AI SDK
    - [ ] Bull (定时任务)
    - [ ] Shadcn/ui

### 1.2 CFO (PA) 核心框架 [/]

#### 1.2.1 CFO Skill 定义

**Skill ID**: `cfo` | **角色**: Personal Assistant | **头像**: 👔

- [ ] **核心能力定义**
    - [ ] 主动任务配置
        - [ ] 盯盘: 每 5-15 分钟
        - [ ] 找机会: 每 12 小时
        - [ ] 异动监控: 事件触发
        - [ ] 报告生成: 每 12 小时
    - [ ] 推理模式: Bull / Bear / Neutral
    - [ ] 情报员调用能力
    - [ ] 用户对话能力
    - [ ] 交易执行能力

- [ ] **Instructions 设计**
    - [ ] system: CFO 核心提示词
    - [ ] context: 你是用户的个人投资助手，主动工作，内心独白决策
    - [ ] reasoning: ReAct CoT 风格的推理框架
    - [ ] constraints: 
        - [ ] "必须使用 Bull/Bear 模式进行天人交战"
        - [ ] "必须记录观点用于统计正确率"
        - [ ] "必要时调用情报员验证数据"

- [ ] **推理框架实现 (ReAct CoT)**
    ```
    Step 1: collect_data - 收集情报
    Step 2: bull_perspective - Bull 视角分析
    Step 3: bear_perspective - Bear 视角分析  
    Step 4: verify_data (可选) - 数据验证
    Step 5: synthesize - 综合判断
    Step 6: decide - 最终决策
    ```

#### 1.2.2 Bull/Bear 推理模式

- [ ] **Bull 推理模式**
    - [ ] 独立 system prompt: "假设你是看多者..."
    - [ ] 输出格式: {opinion, reasoning, confidence}
    - [ ] 记录观点到数据库

- [ ] **Bear 推理模式**
    - [ ] 独立 system prompt: "假设你是看空者..."
    - [ ] 输出格式: {opinion, reasoning, confidence}
    - [ ] 记录观点到数据库

- [ ] **观点记录结构**
    ```typescript
    {
      timestamp: number;
      taskType: "watchlist" | "opportunity" | "anomaly" | "report";
      symbol: string;
      bullView: { opinion, reasoning, confidence };
      bearView: { opinion, reasoning, confidence };
      cfoDecision: string;
      outcome?: {  // 后续回填
        verifiedAt: number;
        priceChange: string;
        bullWasRight: boolean;
        bearWasRight: boolean;
      }
    }
    ```

#### 1.2.3 主动任务实现

- [ ] **盯盘任务 (Watchlist Monitor)**
    - [ ] Cron: 每 15 分钟
    - [ ] 扫描关注列表
    - [ ] 读取技术情报员 Feed
    - [ ] Bull/Bear 推理
    - [ ] 输出持仓/买卖建议
    - [ ] 如信号强，主动与用户对话

- [ ] **找机会任务 (Opportunity Scout)**
    - [ ] Cron: 每 12 小时
    - [ ] 全市场扫描 (Top 500)
    - [ ] Bull/Bear 机会评估
    - [ ] 输出潜力币推荐

- [ ] **异动监控 (Anomaly Alert)**
    - [ ] 监听情报员异动 Feed
    - [ ] 立即触发分析
    - [ ] 快速 Bull/Bear 推理
    - [ ] 实时推送速报给用户

- [ ] **报告任务 (Performance Report)**
    - [ ] Cron: 每 12 小时
    - [ ] 回顾交易记录
    - [ ] 市场复盘
    - [ ] 生成报告并与用户对话

#### 1.2.4 专业求证机制

- [ ] **情报员调用接口**
    ```typescript
    queryIntelligenceAgent({
      agentId: "tech-analysis-agent",
      query: "BTC 的 RSI 和成交量",
      timeframe: "4h"
    })
    ```

- [ ] **调用场景**
    - [ ] Bull/Bear 观点分歧大时
    - [ ] 需要验证关键数据时
    - [ ] 用户追问细节时

### 1.3 情报员设计与开发 [/]

#### 1.3.1 技术分析情报员 (Tech-Analysis-Agent)

**Skill ID**: `tech-analysis-agent` | **头像**: 📊

- [ ] **定位**: 被动响应的情报提供者
- [ ] **能力**:
    - [ ] 定时分析技术指标
    - [ ] 发布 AgentFeed
    - [ ] 响应 CFO 查询
- [ ] **输出 Feed**:
    ```typescript
    {
      feedType: "TECHNICAL",
      symbol: "BTC",
      indicators: { rsi, ma, macd },
      patterns: ["breakout", "golden_cross"],
      signal: "bullish" | "bearish" | "neutral",
      confidence: 0.85,
      summary: "突破24h高点，成交量放大"
    }
    ```

- [ ] **Tools**:
    - [ ] `coingecko:get_price`
    - [ ] `binance:get_klines`
    - [ ] `technical:calculate_indicators`
    - [ ] `technical:detect_patterns`

### 1.4 正确率统计系统 [/]

- [ ] **观点记录**
    - [ ] 每次 Bull/Bear 推理记录观点
    - [ ] 关联任务类型和标的

- [ ] **结果验证**
    - [ ] 定时任务验证历史观点
    - [ ] 基于后续价格走势判断对错
    - [ ] 回填 outcome 字段

- [ ] **统计计算**
    - [ ] Bull 正确率 = Bull正确 / Bull总次数
    - [ ] Bear 正确率 = Bear正确 / Bear总次数
    - [ ] 更新 CFO 的牛熊判断依据

- [ ] **牛熊指标应用**
    - [ ] Bull率 > 70% → 提示可能牛市
    - [ ] Bear率 > 70% → 提示可能熊市
    - [ ] CFO 在决策时参考该指标

### 1.5 用户对话系统 [/]

- [ ] **主动汇报**
    - [ ] CFO 发现重要信号时主动发起对话
    - [ ] 汇报格式: 信号 + 理由 + 建议

- [ ] **被动响应**
    - [ ] 用户可随时询问 CFO
    - [ ] CFO 可查询情报员后回复

- [ ] **确认流程**
    - [ ] CFO: "建议买入 BTC 10%"
    - [ ] 用户: "确认" / "修改" / "驳回"
    - [ ] CFO 执行或调整

### 1.6 Web UI [/]

- [ ] **Dashboard**
    - [ ] CFO 状态显示 (当前任务)
    - [ ] 最新决策卡片
    - [ ] 内心独白展示 (Bull vs Bear)

- [ ] **对话界面**
    - [ ] CFO 聊天窗口
    - [ ] 历史对话记录

- [ ] **正确率统计页**
    - [ ] Bull/Bear 正确率曲线
    - [ ] 市场牛熊指标
    - [ ] 历史观点列表

- [ ] **配置页**
    - [ ] CFO 任务调度配置
    - [ ] 触发阈值调整

### 1.7 数据源 Tools [/]

- [ ] CoinGecko Tools
- [ ] Binance Tools
- [ ] 技术指标计算
- [ ] 组合管理 Tools

---

## Phase 2: 完整 MAS 网络 - [ ]

### 2.1 扩展情报员

#### 2.1.1 巨鲸监控情报员
- [ ] 监控链上大额转账
- [ ] 响应 CFO 查询

#### 2.1.2 舆情分析情报员
- [ ] 监控社媒情绪
- [ ] 响应 CFO 查询

#### 2.1.3 预测市场情报员
- [ ] 监控 Polymarket
- [ ] 响应 CFO 查询

### 2.2 CFO 增强

- [ ] 更多主动任务场景
- [ ] 更复杂的求证逻辑
- [ ] 长期记忆优化

### 2.3 War Room 可视化

- [ ] CFO 内心独白可视化
- [ ] 正确率统计图表
- [ ] 情报员调用链路展示

---

## 关键设计确认

### CFO 工作方式

1. **主动工作**: 四种定时/事件任务
2. **内心独白**: Bull/Bear 推理模式 (ReAct CoT)
3. **专业求证**: 按需调用情报员
4. **正确率统计**: 记录观点，验证结果，统计胜率

### Bull/Bear 模式

- 不是独立 Agent
- 是 CFO 内部的推理子程序
- 使用不同 system prompt
- 每次推理都记录观点

### 情报员

- 被动响应，不主动汇报
- CFO 按需查询
- 返回结构化情报

---

## MAS 成员清单

| 类型 | Skill ID | 命名 | 头像 | Phase |
|------|----------|------|------|-------|
| PA | `cfo` | CFO (Personal Assistant) | 👔 | 1 |
| 情报员 | `tech-analysis-agent` | 技术分析情报员 | 📊 | 1 |
| 情报员 | `whale-monitoring-agent` | 巨鲸监控情报员 | 🐋 | 2 |
| 情报员 | `sentiment-analysis-agent` | 舆情分析情报员 | 📰 | 2 |
| 情报员 | `prediction-market-agent` | 预测市场情报员 | 🎯 | 2 |
