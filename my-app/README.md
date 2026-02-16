# CryptoPulse AI MVP

AI-powered cryptocurrency market analysis platform with dual-perspective (Bull/Bear) reasoning.

## Features

- 🤖 **CFO Agent** - Chief Financial Officer with Bull/Bear dual-reasoning engine
- 📊 **Technical Analyst** - Automated RSI, MA, and trend analysis
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
├── api/
│   ├── market/route.ts   # CoinGecko API proxy
│   └── analysis/route.ts # Analysis endpoints
└── layout.tsx            # Root layout with navigation

lib/
├── data/
│   └── coingecko.ts      # CoinGecko API client
├── agents/
│   ├── base.ts           # BaseAgent abstract class
│   ├── tech-analyst.ts   # Technical Analyst Agent
│   └── cfo.ts            # CFO Agent
├── cfo/
│   ├── reasoning.ts      # Bull/Bear reasoning engine
│   └── tasks.ts          # Watch task scheduler
└── types/
    └── index.ts          # TypeScript type definitions
```

## Tech Stack

- Next.js 14 + TypeScript
- Tailwind CSS (dark theme)
- CoinGecko API (free tier)
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

## API Endpoints

- `GET /api/market?type=prices&symbols=bitcoin,dogecoin` - Get prices
- `GET /api/market?type=overview` - Get market overview
- `GET /api/analysis?type=cfo&symbol=BTC` - Get CFO analysis
- `GET /api/analysis?type=market-overview` - Get full market analysis
- `POST /api/analysis` - Chat with CFO

## Key Design Decisions

1. **Dual-Reasoning Engine**: CFO analyzes both Bull and Bear cases before making recommendations
2. **BaseAgent Pattern**: All agents extend BaseAgent for consistent interface
3. **Request Queue**: CoinGecko API calls are queued to respect rate limits (50/min)
4. **Client-Side Fetching**: Real-time data fetched from browser to avoid SSR API limits

## Notes

- CoinGecko free tier has a 50 calls/minute limit
- Technical indicators calculated on 14-day historical data
- RSI period: 14, MA periods: 7, 14, 30
- Watch tasks run at 5-minute and 15-minute intervals
