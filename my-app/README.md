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

### 2025-02-18
- ✅ Implemented K-line chart page with TradingView Lightweight Charts
- ✅ Integrated DuckDB for local market data storage
- ✅ Created API endpoint `/api/market/klines` with dynamic aggregation
- ✅ Fetched 525,601 BTCUSDT 1-minute K-lines from Binance (2025 full year)
- ✅ Added period switching (1m/5m/15m/1h/4h/1d) with auto-aggregation
- ✅ Fixed DuckDB native module issues for Next.js
- ✅ Added URL parameter support for default timeframe
