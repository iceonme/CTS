# CryptoPulse AI MVP

AI-powered cryptocurrency market analysis platform with dual-perspective (Bull/Bear) reasoning.

## Features

- 🤖 **CFO Agent** - Chief Financial Officer with Bull/Bear dual-reasoning engine
- 📊 **Technical Analyst** - Automated RSI, MA, and trend analysis
- 📈 **K-Line Charts** - TradingView Lightweight Charts with historical data
- 💬 **Interactive Chat** - Ask the CFO about any supported cryptocurrency
- 📡 **Real-time Feed** - Live market intelligence and alerts
- 🎯 **WarRoom Dashboard** - Visual market overview and analysis
- ⏰ **Watch Tasks** - Automated monitoring with configurable intervals

## Project Structure

```
app/
├── page.tsx              # CFO Console (main chat interface)
├── feed/page.tsx         # Intelligence Feed
├── warroom/page.tsx      # WarRoom Dashboard
├── chart/page.tsx        # K-Line Chart with TradingView
├── api/
│   ├── market/route.ts   # CoinGecko API proxy
│   ├── market/klines/route.ts  # K-line data API (DuckDB)
│   └── analysis/route.ts # Analysis endpoints
└── layout.tsx            # Root layout with navigation

lib/
├── data/
│   ├── coingecko.ts      # CoinGecko API client
│   └── market-db.ts      # DuckDB market data client
├── agents/
│   ├── base.ts           # BaseAgent abstract class
│   ├── tech-analyst.ts   # Technical Analyst Agent
│   └── cfo.ts            # CFO Agent
├── cfo/
│   ├── reasoning.ts      # Bull/Bear reasoning engine
│   └── tasks.ts          # Watch task scheduler
└── types/
    └── index.ts          # TypeScript type definitions

data/
└── market-v2.db          # DuckDB database (BTCUSDT 1m K-lines, 2025 full year)

scripts/
└── fetch-binance-data.ts # CLI tool to fetch historical K-lines
```

## Tech Stack

- Next.js 14 + TypeScript
- Tailwind CSS (dark theme)
- CoinGecko API (free tier)
- DuckDB (local market data storage)
- TradingView Lightweight Charts v5
- node-cron for scheduled tasks

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

## Usage

### CFO Console
- Ask about specific cryptocurrencies: "Analyze BTC"
- Get market overview: "Market overview"
- Quick analysis buttons for BTC, DOGE, ETH, SOL

### Feed
- Real-time price alerts (>5% change)
- CFO analysis signals
- Auto-refresh every 30 seconds
- Filter by type and importance

### WarRoom
- Market sentiment gauge
- Asset-by-asset analysis cards
- Bull vs Bear perspective comparison
- Technical indicators detail view

### K-Line Charts (/chart)
- **Timeframes**: 1m, 5m, 15m, 1h, 4h, 1d
- **Auto-aggregation**: 1-minute data aggregated to higher timeframes
- **Smart loading**: Different time ranges per timeframe to avoid browser lag
- **Data**: BTCUSDT 2025 full year (525,601 1-minute candles)
- **URL params**: `?interval=1h` to set default timeframe

## API Endpoints

- `GET /api/market?type=prices&symbols=bitcoin,dogecoin` - Get prices
- `GET /api/market?type=overview` - Get market overview
- `GET /api/market/klines?symbol=BTCUSDT&interval=1m` - Get K-line data
- `GET /api/analysis?type=cfo&symbol=BTC` - Get CFO analysis
- `GET /api/analysis?type=market-overview` - Get full market analysis
- `POST /api/analysis` - Chat with CFO

## Data Pipeline

### Historical K-line Data
- Source: Binance API
- Symbol: BTCUSDT
- Interval: 1 minute
- Period: 2025-01-01 to 2026-01-01
- Records: 525,601
- Storage: Local DuckDB (~42MB)

### Fetching New Data
```bash
npx ts-node scripts/fetch-binance-data.ts
```

## Key Design Decisions

1. **Dual-Reasoning Engine**: CFO analyzes both Bull and Bear cases before making recommendations
2. **BaseAgent Pattern**: All agents extend BaseAgent for consistent interface
3. **Request Queue**: CoinGecko API calls are queued to respect rate limits (50/min)
4. **Client-Side Fetching**: Real-time data fetched from browser to avoid SSR API limits
5. **DuckDB Integration**: Local columnar database for efficient time-series queries
6. **Dynamic Aggregation**: Higher timeframes computed on-the-fly from 1-minute base data

## Notes

- CoinGecko free tier has a 50 calls/minute limit
- Technical indicators calculated on 14-day historical data
- RSI period: 14, MA periods: 7, 14, 30
- Watch tasks run at 5-minute and 15-minute intervals
- K-line data auto-loads based on timeframe (1m: 7 days, 5m: 30 days, 1h/1d: 365 days)

## Development Log

### 2026-02-20 (Today)
- ✅ 修复竞技场图表实时渲染问题，确保大步长回测图表同步更新
- ✅ 修复净值计算静态 Bug，实现全局资产定时重估，解决“死线”问题
- ✅ 优化 MiniMax Token 消耗：切换 `MiniMax-Text-01` 模型 + 引入极简 CSV 数据格式
- ✅ 修复 LLM 数据源缺失问题：实现 1m 原始数据手动聚合为 1h 采样线
- ✅ 增强 MiniMax 客户端鲁棒性，增加防御性校验与详细调试日志

## Future Roadmap

- 🛠 **增强 AI 决策能力**：为 LLM 提示词引入 MA、RSI、MACD 等技术指标
- 🔍 **多时区视野分析**：整合日线与小时线数据，提升模型对宏观趋势的把握
- 🧠 **推理框架优化**：重构 System Prompt，引导模型采用结构化思维链分析
- ⚖️ **交易精度验证**：优化 `VirtualPortfolio` 大额订单执行精度及手续费处理
