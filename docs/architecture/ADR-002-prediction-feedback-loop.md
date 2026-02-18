# ADR-002: Agent 预测-验证-反思闭环架构

> **状态**: 设计完成，待实施  
> **日期**: 2026-02-18  
> **作者**: TradeMind Team  

---

## 1. 背景与目标

### 1.1 当前问题
- Agent 只会"报数"（"RSI 是 75"），不会给出后市判断
- Feed 信息噪音大，缺乏"为什么现在说"的上下文
- 无法追踪 Agent 的预测准确率，无法自我进化

### 1.2 设计目标
让每个 Agent 成为**领域预言家**：
1. **给出预测**：不只是描述现状，要给出后市判断
2. **验证追踪**：记录"我说了→实际发生"的闭环
3. **自我反思**：根据准确率调整策略，进化能力
4. **集体智慧**：PA 综合各 Agent 预测做加权决策

---

## 2. 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│  1. 数据输入（本职数据采集）                                    │
│     技术分析员：K线数据 → 计算指标                             │
│     宏观分析员：政策/数据 → 解读影响                           │
│     情绪分析员：社交媒体 → 情绪指数                            │
└──────────────────┬──────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  2. 生成判断（预测而不仅是描述）                                │
│     - 当前状态："RSI 超买"                                     │
│     - 后市判断："预计 24h 内回调 3-5%，置信度 75%"             │
│     - 关键条件："如果跌破 $95,000，则趋势转空"                  │
└──────────────────┬──────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  3. 条件发布（有意义时才发声）                                  │
│     - 高置信度预测（>70%）                                     │
│     - 与之前判断相反（观点反转）                                │
│     - 关键价位触发（支撑/阻力突破）                             │
└──────────────────┬──────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  4. 预测入库（给未来的自己）                                    │
│     - 记录：我在 T 时刻预测 X 会在 Y 时间发生                   │
│     - 状态：pending → 等待验证                                 │
└──────────────────┬──────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  5. 验证复盘（定时执行）                                        │
│     - 对比预测 vs 实际结果                                     │
│     - 计算准确率，记录到 Individual Memory                      │
│     - 发布复盘 Feed（高价值时）                                │
└──────────────────┬──────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  6. 自我调整（基于历史表现）                                    │
│     - 准确率低的策略降低权重                                   │
│     - 增加附加条件过滤假信号                                   │
│     - 发布"我调整了"的 Feed                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 核心数据结构设计

### 3.1 Prediction（预测）

```typescript
// lib/types/prediction.ts

interface Prediction {
  id: string;
  agentId: string;           // 谁做的预测
  type: 'price' | 'trend' | 'volatility' | 'event';
  
  // 预测内容
  content: {
    statement: string;       // "BTC 将在 24h 内回调 3-5%"
    condition?: string;      // "如果 RSI 维持在 70 以上"
    targetSymbol: string;
    targetPrice?: {
      direction: 'above' | 'below';
      value: number;
    };
    timeWindow: {
      start: number;         // 预测生效时间
      end: number;           // 预测过期时间
    };
  };
  
  // 置信度
  confidence: number;        // 0-1
  reasoning: string;         // 为什么这样判断
  
  // 验证相关
  status: 'pending' | 'verified' | 'expired' | 'invalidated';
  verifiedAt?: number;
  accuracy?: number;         // 实际准确度（0-1）
  actualResult?: string;     // 实际发生了什么
  
  // 记忆关联
  context: {
    indicatorsSnapshot: Record<string, number>;  // 预测时的指标状态
    similarPredictions: string[];                // 历史上类似的预测ID
    marketContext: string;                       // 当时的宏观背景
  };
  
  timestamp: number;
}
```

### 3.2 PredictiveAgent 接口

```typescript
interface PredictiveAgent {
  // 生成预测
  generatePrediction(data: MarketData): Prediction | null;
  
  // 验证历史预测（定时执行）
  verifyPredictions(): Promise<void>;
  
  // 基于验证结果自我调整
  adjustStrategy(verificationResults: VerificationResult[]): void;
}
```

### 3.3 AgentPerformance（成绩单）

```typescript
interface AgentPerformance {
  agentId: string;
  period: '7d' | '30d' | '90d';
  
  overall: {
    totalPredictions: number;
    verified: number;        // 已验证的
    accuracy: number;        // 整体准确率
    avgConfidence: number;   // 平均置信度（看是否校准）
  };
  
  byPattern: {
    pattern: string;
    count: number;
    accuracy: number;
    avgReturn: number;       // 平均收益（如果按预测操作）
  }[];
  
  calibration: {             // 置信度校准度
    perfect: boolean;        // 预测80%置信度实际是否~80%准确率
    suggestion?: string;
  };
}
```

---

## 4. Agent 实现示例：技术分析员

```typescript
// lib/agents/tech-analyst.ts

class TechnicalAnalyst extends BaseAgent implements PredictiveAgent {
  private activePredictions: Map<string, Prediction> = new Map();
  
  /**
   * 核心：从"报数"升级为"判断"
   */
  generatePrediction(data: MarketData): Prediction | null {
    const indicators = this.computeIndicators(data);
    
    // 场景1：RSI 超买 + 顶背离 = 回调预测
    if (indicators.rsi > 70 && this.checkDivergence('bearish')) {
      return this.createPrediction({
        statement: `${data.symbol} 预计 12-24h 内回调 3-5%`,
        condition: 'RSI 超买 + 顶背离形成',
        confidence: this.calculateConfidence('rsi_reversal', indicators),
        timeframe: 24 * 60 * 60 * 1000,
        expectedOutcome: { type: 'price_drop', magnitude: 0.03 }
      });
    }
    
    // 场景2：突破关键阻力 = 趋势延续预测
    if (this.checkBreakout(data, 'resistance')) {
      return this.createPrediction({
        statement: `${data.symbol} 突破阻力，预计上涨 5-8%`,
        condition: '放量突破 + 成交量确认',
        confidence: 0.75,
        timeframe: 48 * 60 * 60 * 1000,
      });
    }
    
    // 场景3：无明确信号 = 不发预测
    return null;
  }
  
  /**
   * 计算置信度（基于历史准确率）
   */
  private calculateConfidence(pattern: string, indicators: Indicators): number {
    let baseConfidence = 0.6;
    
    // 根据当前指标强度调整
    if (indicators.rsi > 80) baseConfidence += 0.1;
    if (indicators.volume > indicators.avgVolume * 1.5) baseConfidence += 0.1;
    
    // 根据历史准确率调整（Individual Memory）
    const historicalAccuracy = this.memory.individual.getAccuracyForPattern(pattern);
    baseConfidence = baseConfidence * 0.5 + historicalAccuracy * 0.5;
    
    return Math.min(0.95, baseConfidence);
  }
  
  /**
   * 验证历史预测（每天执行一次）
   */
  async verifyPredictions(): Promise<void> {
    const now = Date.now();
    
    for (const [id, prediction] of this.activePredictions) {
      if (prediction.content.timeWindow.end > now) continue;
      
      // 获取实际数据
      const actualData = await this.fetchDataForPeriod(
        prediction.content.targetSymbol,
        prediction.content.timeWindow.start,
        now
      );
      
      // 验证准确性
      const accuracy = this.calculateAccuracy(prediction, actualData);
      prediction.status = accuracy > 0.7 ? 'verified' : 'expired';
      prediction.accuracy = accuracy;
      prediction.verifiedAt = now;
      
      // 记录到 Individual Memory
      this.memory.individual.addExperience({
        type: 'prediction',
        content: prediction.content.statement,
        result: accuracy > 0.7 ? 'success' : 'failure',
        metadata: { predictionId: id, accuracy, pattern: prediction.content.condition }
      });
      
      // 发布复盘 Feed（高价值时）
      if (accuracy > 0.8 || accuracy < 0.3) {
        this.publishVerificationFeed(prediction);
      }
      
      this.activePredictions.delete(id);
    }
  }
  
  /**
   * 基于验证结果自我调整
   */
  adjustStrategy(results: VerificationResult[]): void {
    const stats = this.analyzeAccuracyByPattern(results);
    
    // 如果"RSI 超买"策略准确率 < 50%，调整参数
    if (stats['rsi_reversal']?.accuracy < 0.5) {
      this.adjustThreshold('rsi_reversal', {
        minRsi: 75,              // 从 70 提高到 75
        requireVolume: true,     // 必须配合放量
      });
      
      this.publishToFeed({
        type: 'self_adjustment',
        content: '我发现"RSI 超买"判断准确率偏低，已调整触发条件',
        metadata: { pattern: 'rsi_reversal', oldAccuracy: stats['rsi_reversal'].accuracy }
      });
    }
  }
}
```

---

## 5. Feed 格式升级

### 5.1 Observation Feed（现状描述）
```json
{
  "type": "observation",
  "title": "BTC RSI 进入超买区",
  "content": "当前 RSI 72，处于超买状态"
}
```

### 5.2 Prediction Feed（预测情报）⭐核心
```json
{
  "type": "prediction",
  "agentId": "tech-analyst",
  "title": "📊 技术分析员：BTC 预计 24h 内回调",
  "content": {
    "prediction": "预计回调 3-5%，目标价位 $92,000-$94,000",
    "reasoning": "RSI 超买(72) + 顶背离形成 + 成交量萎缩",
    "confidence": 0.78,
    "conditions": [
      "如果 RSI 跌破 70，判断失效",
      "如果放量突破 $98,000，转为看涨"
    ],
    "timeframe": "24小时内"
  },
  "metadata": {
    "predictionId": "pred_tech_001",
    "agentAccuracy": 0.72,
    "indicatorsSnapshot": { "rsi": 72, "ma7": 96500, "volume": 1.2 }
  }
}
```

### 5.3 Verification Feed（复盘验证）
```json
{
  "type": "verification",
  "agentId": "tech-analyst",
  "title": "✅ 技术分析员预测验证：正确",
  "content": {
    "originalPrediction": "24h 内回调 3-5%",
    "actualResult": "实际回调 4.2%",
    "accuracy": 0.95,
    "lesson": "顶背离 + RSI 超买组合在本次行情中有效"
  },
  "metadata": {
    "predictionId": "pred_tech_001",
    "impact": "positive"
  }
}
```

---

## 6. PA 综合决策逻辑

```typescript
// lib/agents/pa.ts

class PA extends BaseAgent {
  async makeDecision(symbol: string): Promise<Decision> {
    // 1. 获取所有 Agent 的活跃预测
    const predictions = this.collectPredictionsFromAgents(symbol);
    
    // 2. 按领域分组
    const byDomain = {
      technical: predictions.filter(p => p.agentId === 'tech-analyst'),
      macro: predictions.filter(p => p.agentId === 'macro-analyst'),
      sentiment: predictions.filter(p => p.agentId === 'sentiment-analyst'),
    };
    
    // 3. 计算共识度
    const consensus = this.calculateConsensus(predictions);
    
    // 4. 加权决策（权重基于各 Agent 历史准确率）
    const weightedScore = 
      byDomain.technical[0]?.confidence * this.getAgentWeight('tech-analyst') +
      byDomain.macro[0]?.confidence * this.getAgentWeight('macro-analyst') * 0.8 +
      byDomain.sentiment[0]?.confidence * this.getAgentWeight('sentiment-analyst') * 0.6;
    
    // 5. 生成带推理的建议
    return {
      signal: weightedScore > 0.7 ? 'LONG' : weightedScore < 0.3 ? 'SHORT' : 'HOLD',
      confidence: weightedScore,
      reasoning: this.generateReasoning(byDomain, consensus),
      supportingPredictions: predictions.map(p => p.id),
    };
  }
  
  generateReasoning(byDomain: DomainPredictions, consensus: Consensus): string {
    const parts: string[] = [];
    
    if (byDomain.technical.length > 0) {
      parts.push(`技术面：${byDomain.technical[0].content.statement}（置信度 ${byDomain.technical[0].confidence}）`);
    }
    
    if (byDomain.macro.length > 0) {
      parts.push(`宏观面：${byDomain.macro[0].content.statement}`);
    }
    
    if (consensus.agreement > 0.8) {
      parts.push('各维度观点高度一致。');
    } else if (consensus.conflict > 0.5) {
      parts.push('⚠️ 注意：各维度存在分歧，建议降低仓位。');
    }
    
    return parts.join('\n');
  }
}
```

---

## 7. 闭环时序图

```
时间线 ───────────────────────────────────────────────────────────►

T+0    技术分析员
       ├─ 检测到 RSI 超买 + 顶背离
       ├─ 生成预测："24h 内回调 3-5%，置信度 75%"
       └─ 发布 Feed（给 PA 和集体记忆）

       PA
       └─ 收到预测，结合其他 Agent 意见，建议用户"减仓"

T+6h   市场实际回调 2%
       ├─ 技术分析员记录：预测部分正确
       └─ 用户可能选择获利了结

T+24h  验证时刻
       ├─ 实际回调 4.5%（符合预测范围）
       ├─ 技术分析员标记预测为"verified"，准确率 90%
       ├─ 更新 Individual Memory："顶背离+RSI"策略准确率 +1
       └─ 发布复盘 Feed："✅ 上次预测验证成功"

T+48h  再次出现 RSI 超买
       ├─ 技术分析员查询记忆："该模式上次准确率 90%"
       ├─ 提高本次置信度到 85%
       └─ 发布新的预测 Feed

每月   自我反思
       ├─ 统计各策略准确率
       ├─ 发现"RSI 超买"在牛市中准确率只有 40%
       └─ 自动调整：牛市中 RSI 超买改为"持仓观察"而非"做空"
```

---

## 8. 实施路线图

### Phase 1：基础预测能力（P0）
- [ ] 定义 `Prediction` 数据结构和数据库表
- [ ] 改造 `TechnicalAnalyst`：添加 `generatePrediction` 方法
- [ ] 实现基础预测场景（RSI 超买/超卖、突破）
- [ ] Feed 系统支持 `type: 'prediction'`

### Phase 2：验证与追踪（P1）
- [ ] 实现 `verifyPredictions` 定时任务
- [ ] 添加准确率统计到 `IndividualMemory`
- [ ] 实现 `VerificationFeed` 发布
- [ ] 简单 Dashboard 展示各 Agent 准确率

### Phase 3：PA 综合决策（P1）
- [ ] PA 收集并加权各 Agent 预测
- [ ] 基于历史准确率动态调整 Agent 权重
- [ ] 生成带多维度推理的决策建议

### Phase 4：自我进化（P2）
- [ ] 实现 `adjustStrategy` 自动调整
- [ ] 策略参数动态优化
- [ ] 预测置信度校准（避免过度自信）

### Phase 5：扩展 Agent（P3）
- [ ] 宏观分析员：政策/数据事件预测
- [ ] 情绪分析员：市场情绪转折点预测
- [ ] 巨鲸监控员：大额流动预测

---

## 9. 关键设计决策

### 9.1 什么时候发预测 Feed？
| 条件 | 说明 |
|------|------|
| 置信度 > 70% | 高置信度才发，避免噪音 |
| 观点反转 | 与之前判断相反时（如从看涨转看跌）|
| 关键价位 | 突破支撑/阻力位时 |
| 时间间隔 | 同一模式 30 分钟内不重复发 |

### 9.2 如何计算准确率？
```typescript
// 价格预测准确率
function calculatePriceAccuracy(prediction: Prediction, actual: MarketData): number {
  const predictedRange = prediction.content.targetRange; // { min, max }
  const actualPrice = actual.close;
  
  if (actualPrice >= predictedRange.min && actualPrice <= predictedRange.max) {
    return 1.0; // 完全准确
  }
  
  // 偏离越大，准确率越低
  const deviation = Math.min(
    Math.abs(actualPrice - predictedRange.min),
    Math.abs(actualPrice - predictedRange.max)
  );
  const rangeSize = predictedRange.max - predictedRange.min;
  
  return Math.max(0, 1 - (deviation / rangeSize));
}
```

### 9.3 如何避免过度自信？
- **置信度校准**：如果 Agent 总是说"80% 置信"但实际只有 50% 准确，要惩罚
- **不确定性表达**：低置信度时明确说"不确定"，而不是硬猜
- **条件预测**：多用"如果 X 发生，则 Y"，而不是绝对判断

---

## 10. 示例场景

### 场景：BTC 突破 $100,000

**T+0（突破时）**
- 技术分析员："放量突破关键阻力，预计 48h 内上涨 5-8%（置信度 80%）"
- 情绪分析员："FOMO 情绪升温，但可能过热（置信度 65%）"
- PA 综合："技术面强烈看多，但情绪面警示，建议分批入场"

**T+24h（上涨 3%）**
- 技术分析员：预测进行中，继续观察

**T+48h（上涨 7%，达到预测目标）**
- 技术分析员：标记预测"verified"，准确率 100%，更新记忆
- 情绪分析员："极度贪婪，建议止盈"

**T+72h（开始回调）**
- 技术分析员基于历史模式："突破后常伴随 10-15% 回调，建议减仓"

---

## 参考文档

- [ADR-001: Agent 框架架构](./ADR-001-agent-framework.md)
- [产品愿景](../product/product_vision.md)
- [MVP 功能](../mvp_functional.md)
