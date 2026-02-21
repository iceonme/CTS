# 量化交易指标计算指南

> **TradeMind 技术分析指标大全**  
> 基于 K线数据（OHLCV）可计算的技术指标  
> **覆盖度：约 85-90% 的常用技术指标**

---

## 1. 数据基础

### 1.1 可用数据字段

| 字段 | 说明 | 来源 |
|------|------|------|
| `timestamp` | 时间戳（毫秒，UTC） | Binance |
| `open` | 开盘价 | Binance |
| `high` | 最高价 | Binance |
| `low` | 最低价 | Binance |
| `close` | 收盘价 | Binance |
| `volume` | 交易量（BTC） | Binance |
| `quoteVolume` | 计价货币交易量（USDT） | Binance |
| `tradeCount` | 成交笔数 | Binance |
| `takerBuyBaseVolume` | 买方主动吃单量（BTC） | Binance |

### 1.2 数据覆盖范围

- **时间跨度**：2025年全年（366天）
- **原始周期**：1分钟线（约 50万+ 条记录）
- **可聚合周期**：1m, 5m, 15m, 1h, 4h, 1d

---

## 2. 指标分类与计算

### 2.1 趋势类指标（判断方向）

#### MA - 简单移动平均线
```typescript
function calculateMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];
  const slice = prices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

// 常用周期
// MA7  - 短期趋势
// MA14/MA25 - 中期趋势  
// MA50/MA200 - 长期趋势

// 用法
// MA7 > MA14 > MA50 = 多头排列（看涨）
// MA7 < MA14 < MA50 = 空头排列（看跌）
```

#### EMA - 指数移动平均线
```typescript
function calculateEMA(prices: number[], period: number): number {
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  return ema;
}

// 特点：对近期价格更敏感，更快反映趋势变化
// 常用：EMA12 + EMA26（MACD的基础）
```

#### MACD - 异同移动平均线
```typescript
interface MACDResult {
  dif: number;      // 快线 (EMA12 - EMA26)
  dea: number;      // 慢线 (DIF的EMA9)
  histogram: number; // 柱状图 (DIF - DEA)
}

function calculateMACD(prices: number[]): MACDResult {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const dif = ema12 - ema26;
  // dea 是 dif 的 EMA9
  // histogram = dif - dea
  return { dif, dea: dif * 0.9, histogram: dif * 0.1 };
}

// 信号
// 金叉：DIF 上穿 DEA（看涨）
// 死叉：DIF 下穿 DEA（看跌）
// 柱状图由负转正： momentum 增强
```

#### ADX - 平均趋向指数
```typescript
// 衡量趋势强度，不判断方向
// ADX > 25：趋势明显（可以追涨杀跌）
// ADX < 20：震荡行情（高抛低吸）
// ADX > 50：趋势极强（可能反转）
```

---

### 2.2 动量类指标（判断超买超卖）

#### RSI - 相对强弱指数
```typescript
function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length <= period) return 50;

  let gains = 0;
  let losses = 0;

  // 计算初始平均涨跌
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // 平滑移动平均
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    let currentGain = change >= 0 ? change : 0;
    let currentLoss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// 解读
// RSI > 70：超买（可能回调）
// RSI > 80：严重超买（回调概率大）
// RSI < 30：超卖（可能反弹）
// RSI < 20：严重超卖（反弹概率大）
// RSI 50-70：强势区间
// RSI 30-50：弱势区间
```

#### KDJ - 随机指标
```typescript
// RSV = (Close - Lowest Low) / (Highest High - Lowest Low) * 100
// K = 2/3 * 前K + 1/3 * RSV
// D = 2/3 * 前D + 1/3 * K
// J = 3K - 2D

// 信号
// K 上穿 D：金叉（买入）
// K 下穿 D：死叉（卖出）
// J > 100：超买
// J < 0：超卖
```

#### CCI - 商品通道指数
```typescript
// CCI = (Typical Price - SMA) / (0.015 * Mean Deviation)
// Typical Price = (High + Low + Close) / 3

// 信号
// CCI > +100：超买
// CCI < -100：超卖
// 突破 +100 向上：强烈看涨
// 突破 -100 向下：强烈看跌
```

#### Williams %R
```typescript
// %R = (Highest High - Close) / (Highest High - Lowest Low) * -100

// 信号
// %R > -20：超买
// %R < -80：超卖
// 与 RSI 类似，但计算方式相反
```

---

### 2.3 波动率类指标（判断风险）

#### 布林带 (Bollinger Bands)
```typescript
interface BollingerBands {
  upper: number;   // 上轨 = MA20 + 2 * 标准差
  middle: number;  // 中轨 = MA20
  lower: number;   // 下轨 = MA20 - 2 * 标准差
  bandwidth: number; // 带宽 = (上轨-下轨)/中轨
}

function calculateBB(prices: number[], period: number = 20): BollingerBands {
  const ma = calculateMA(prices, period);
  const std = calculateStd(prices.slice(-period));
  
  return {
    upper: ma + 2 * std,
    middle: ma,
    lower: ma - 2 * std,
    bandwidth: (4 * std) / ma
  };
}

// 信号
// 价格触及上轨：可能超买
// 价格触及下轨：可能超卖
// 带宽收窄（squeeze）：即将有大波动
// 带宽扩张：趋势加速
```

#### ATR - 平均真实波幅
```typescript
// True Range = max(
//   High - Low,
//   |High - 前Close|,
//   |Low - 前Close|
// )
// ATR = MA(True Range, 14)

// 用途
// 设置止损：Stop Loss = Entry - 2 * ATR
// 仓位管理：仓位大小与 ATR 成反比
// 波动率判断：ATR 上升 = 波动加大
```

#### 标准差 (Standard Deviation)
```typescript
// 衡量价格波动幅度
// 用于计算布林带
// 也可单独使用判断波动率
```

---

### 2.4 成交量类指标（判断真假突破）

#### 量价配合分析
```typescript
// 基础逻辑
interface VolumeAnalysis {
  priceChange: number;    // 价格变化百分比
  volumeChange: number;   // 成交量 vs 平均值
  signal: 'genuine' | 'fake' | 'neutral';
}

// 判断规则
// 涨价 + 放量 > 120%：真涨（资金进场）✅
// 涨价 + 缩量 < 80%：假涨（无人跟）⚠️
// 跌价 + 放量 > 150%：恐慌抛售 🔴
// 跌价 + 缩量 < 70%：无人买也无人卖 🤔
```

#### VWAP - 成交量加权平均价
```typescript
// VWAP = Σ(Price * Volume) / Σ(Volume)

// 用途
// 机构成本线：价格 > VWAP = 机构赚钱（看涨）
// 日内交易：突破 VWAP 做多，跌破做空
// 支撑阻力：VWAP 常作为动态支撑/阻力
```

#### OBV - 能量潮
```typescript
// OBV = 前OBV + (Close > 前Close ? Volume : -Volume)

// 信号
// OBV 上升 + 价格上升：确认上涨趋势 ✅
// OBV 下降 + 价格下降：确认下跌趋势 ✅
// OBV 上升 + 价格下降：底背离（看涨）🔥
// OBV 下降 + 价格上升：顶背离（看跌）🔥
```

#### 量比 (Volume Ratio)
```typescript
// 量比 = 当前成交量 / 过去N周期平均成交量

// 判断
// 量比 > 2：放量（关注）
// 量比 > 3：异常放量（可能有大事）
// 量比 < 0.5：缩量（观望）
```

#### 买卖力量对比
```typescript
// 使用 takerBuyBaseVolume 字段
// 买方主动吃单比例 = Taker Buy Volume / Total Volume

// 信号
// > 55%：买方强势
// > 60%：买方非常强势
// < 45%：卖方强势
// < 40%：卖方非常强势
```

---

### 2.5 形态类指标（看图说话）

#### 支撑与阻力
```typescript
// 基于近期高低点识别
// 支撑位：过去N个周期的低点
// 阻力位：过去N个周期的高点

// 动态计算
// 支撑位 = 过去20个周期的最低价
// 阻力位 = 过去20个周期的最高价

// 突破判断
// 价格 > 阻力位 * 1.02（2%突破确认）
// 价格 < 支撑位 * 0.98（跌破确认）
```

#### 顶背离 / 底背离
```typescript
// 顶背离（看跌）
// 价格创新高，但指标（RSI/MACD）未创新高

// 底背离（看涨）
// 价格创新低，但指标（RSI/MACD）未创新低

// 代码逻辑
function checkDivergence(
  prices: number[], 
  indicator: number[], 
  type: 'bullish' | 'bearish'
): boolean {
  const priceHighs = findLocalHighs(prices);
  const indHighs = findLocalHighs(indicator);
  
  // 顶背离：价格新高，指标未新高
  if (type === 'bearish') {
    return prices[priceHighs[0]] > prices[priceHighs[1]] &&
           indicator[indHighs[0]] < indicator[indHighs[1]];
  }
  
  // 底背离：价格新低，指标未新低
  return prices[priceLows[0]] < prices[priceLows[1]] &&
         indicator[indLows[0]] > indicator[indLows[1]];
}
```

#### 金叉 / 死叉
```typescript
// 金叉：短期均线上穿长期均线
// 死叉：短期均线下穿长期均线

// 常用组合
// MA7 与 MA14
// MA12 与 MA26（MACD基础）
// 金叉 + 放量 = 强信号
// 死叉 + 缩量 = 弱信号
```

#### 经典K线形态
```typescript
// 锤子线（Hammer）
// 下影线 > 2倍实体，出现在下跌末端 = 看涨

// 上吊线（Hanging Man）
// 下影线 > 2倍实体，出现在上涨末端 = 看跌

// 吞没形态（Engulfing）
// 阳线实体完全包住前一根阴线 = 看涨
// 阴线实体完全包住前一根阳线 = 看跌

// 十字星（Doji）
// 开盘价 ≈ 收盘价，上下影线较长
// 表示犹豫，可能反转
```

---

### 2.6 资金流向类指标

#### MFI - 资金流量指标
```typescript
// MFI = 100 - (100 / (1 + Money Flow Ratio))
// Money Flow = Typical Price * Volume

// 与 RSI 类似，但加入成交量权重
// MFI > 80：超买（资金流出）
// MFI < 20：超卖（资金流入）
// 背离信号比 RSI 更可靠
```

#### 大单资金流向
```typescript
// 基于 tradeCount 和 volume 估算
// 大单 = Volume / TradeCount > 平均值 * 1.5

// 用途
// 大单净流入：机构进场
// 大单净流出：机构出货
```

---

## 3. 指标组合策略

### 3.1 趋势跟踪策略
```typescript
// 条件
// 1. MA7 > MA14 > MA50（多头排列）
// 2. MACD 金叉且柱状图转正
// 3. 成交量 > 平均量 * 1.2
// 4. RSI 40-70（健康区间，不追极端）

// 买入
// 全部满足 = 买入信号

// 卖出
// MA7 下穿 MA14 = 卖出信号
// 或 RSI > 80 = 止盈
```

### 3.2 均值回归策略
```typescript
// 条件
// 1. 价格触及布林带下轨
// 2. RSI < 30（超卖）
// 3. 出现底背离
// 4. 成交量萎缩后放量

// 买入
// 4个条件满足3个 = 买入

// 卖出
// 价格回到布林带中轨 = 止盈
// 或 RSI > 50 = 离场
```

### 3.3 突破策略
```typescript
// 条件
// 1. 价格突破 20 日高点
// 2. 成交量 > 平均量 * 1.5
// 3. 布林带带宽收窄后扩张（squeeze）
// 4. ADX > 25（趋势足够强）

// 买入
// 全部满足 = 突破买入

// 止损
// 跌破突破前高点 = 假突破，止损
```

### 3.4 多因子评分系统
```typescript
function calculateCompositeScore(data: MarketData): number {
  let score = 50; // 中性起点
  
  // 趋势因子 (+20)
  if (data.ma7 > data.ma14) score += 10;
  if (data.ma14 > data.ma50) score += 10;
  
  // 动量因子 (+20)
  if (data.rsi > 50 && data.rsi < 70) score += 10; // 健康强势
  if (data.macd > 0) score += 10;
  
  // 成交量因子 (+20)
  if (data.volume > data.avgVolume * 1.2) score += 10;
  if (data.obv > data.obvPrev) score += 10;
  
  // 波动率因子 (+20)
  if (data.price > data.bbLower && data.price < data.bbUpper) score += 10;
  if (data.adx > 25) score += 10;
  
  // 背离因子 (+20)
  if (data.bullishDivergence) score += 20;
  if (data.bearishDivergence) score -= 20;
  
  return Math.max(0, Math.min(100, score));
}

// 评分解读
// 80-100：强烈看多
// 60-79：偏多
// 40-59：观望
// 20-39：偏空
// 0-19：强烈看空
```

---

## 4. 指标可用性总结

### 4.1 可计算的指标（✅ 基于现有数据）

| 类别 | 指标 | 复杂度 | 优先级 |
|------|------|--------|--------|
| **趋势** | MA, EMA, MACD, ADX | ⭐ | P0 |
| **动量** | RSI, KDJ, CCI, Williams %R | ⭐ | P0 |
| **波动率** | 布林带, ATR, 标准差 | ⭐⭐ | P1 |
| **成交量** | VWAP, OBV, 量比, 买卖力量 | ⭐ | P1 |
| **形态** | 支撑阻力, 背离, 金叉死叉 | ⭐⭐ | P1 |
| **资金** | MFI, 大单估算 | ⭐⭐ | P2 |
| **K线** | 锤子线, 吞没, 十字星 | ⭐⭐ | P2 |

### 4.2 无法计算的指标（❌ 需要额外数据）

| 指标 | 缺失数据 | 替代方案 |
|------|----------|----------|
| 订单簿深度 | 盘口挂单数据 | 用成交量估算 |
| 持仓量 (OI) | 期货数据 | 不适用现货 |
| 链上数据 | 巨鲸转账 | 等未来接入 |
| 融资利率 | 合约数据 | 不适用现货 |
| 期权数据 | IV, Skew | 等未来接入 |

---

## 5. 实施建议

### 5.1 优先级排序

| 阶段 | 指标 | 用途 |
|------|------|------|
| **Week 1** | MA, RSI, Volume | 基础趋势判断 |
| **Week 2** | MACD, 布林带 | 趋势确认和波动率 |
| **Week 3** | 背离检测, 支撑阻力 | 买卖点识别 |
| **Week 4** | 多因子评分 | 综合决策 |

### 5.2 代码组织建议

```
lib/indicators/
├── trend/
│   ├── ma.ts          # MA, EMA
│   ├── macd.ts        # MACD
│   └── adx.ts         # ADX
├── momentum/
│   ├── rsi.ts         # RSI
│   ├── kdj.ts         # KDJ
│   └── cci.ts         # CCI
├── volatility/
│   ├── bollinger.ts   # 布林带
│   └── atr.ts         # ATR
├── volume/
│   ├── vwap.ts        # VWAP
│   ├── obv.ts         # OBV
│   └── flow.ts        # 资金流向
└── composite/
    └── scorer.ts      # 多因子评分
```

### 5.3 性能优化

```typescript
// 1. 缓存计算结果
class IndicatorCache {
  private cache = new Map<string, number>();
  
  get(key: string): number | undefined {
    return this.cache.get(key);
  }
  
  set(key: string, value: number, ttl: number): void {
    this.cache.set(key, value);
    setTimeout(() => this.cache.delete(key), ttl);
  }
}

// 2. 批量计算
function calculateAllIndicators(data: KlineData[]): IndicatorSet {
  const prices = data.map(d => d.close);
  const volumes = data.map(d => d.volume);
  
  return {
    ma: calculateMAs(prices),      // 一次算多个MA
    rsi: calculateRSI(prices),
    bb: calculateBB(prices),
    volume: analyzeVolume(volumes),
  };
}

// 3. 增量更新（新数据来时只算最新）
function updateIndicators(
  current: IndicatorSet, 
  newData: KlineData
): IndicatorSet {
  // 使用增量算法更新，而非重算全部
}
```

---

## 6. 参考资源

- **TradingView**: [Pine Script 内置指标文档](https://www.tradingview.com/pine-script-reference/v5/)
- **Investopedia**: [技术指标详解](https://www.investopedia.com/terms/t/technicalindicator.asp)
- **Binance API**: [K线数据格式](https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data)

---

**TradeMind 团队**  
*数据驱动，让每个人都能做量化交易*
