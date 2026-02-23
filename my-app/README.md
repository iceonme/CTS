# TradeMind 核心应用 (my-app)

> **技术指南与开发者文档**

这是 TradeMind 的前端与后端服务核心，基于 Next.js 14 构建，集成了多智能体框架与高性能行情数据库。

---

## 🛠️ 技术栈 (Tech Stack)

- **框架**: Next.js 14 (App Router) + TypeScript
- **样式**: Tailwind CSS (Dark Mode Primary)
- **行情数据库**: DuckDB (本地内存列式存储，适合时间序列查询)
- **图表库**: TradingView Lightweight Charts v5
- **外部数据源**: CoinGecko API (免费层级)
- **智能体接口**: MiniMax API / OpenAI API

---

## 📂 应用结构

```bash
my-app/
├── app/                      # 页面与路由
│   ├── arena/                # 交易策略回测竞技场
│   ├── warroom/              # 市场研判室 (CFO)
│   ├── feed/                 # 智能情报流
│   ├── chart/                # K线行情图表
│   └── api/                  # API 端点总站
├── lib/                      # 核心逻辑
│   ├── agents/               # 智能体(Contestant) 具体实现
│   ├── core/                 # 回测引擎、时钟、组合管理(Portfolio)
│   ├── trading/              # 指标计算、信号识别、K线聚合
│   └── data/                 # DuckDB 与 API 代理封装
└── scripts/                  # 运维与同步脚本 (fetch-data, debug)
```

---

## 📡 API 核心接口

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/market/klines` | `GET` | 获取 K 线数据（支持 symbol, interval, limit 参数） |
| `/api/backtest/run` | `POST` | (Legacy) 运行回测任务 |
| `/api/analysis` | `POST` | 与智能体（CFO 等）进行交互对话 |
| `/api/market` | `GET` | 获取实时价格与市场概览（CoinGecko 代理） |

---

## 📊 数据流水线 (Data Pipeline)

### 1. 历史数据存储
- **路径**: `my-app/data/market-v2.db`
- **内容**: 2025-01-01 至 2026-01-01 的 BTCUSDT 1分钟 K 线。
- **记录数**: 525,601 条。

### 2. 动态聚合逻辑
系统默认从 1 分钟精度读取，并在 API 层或客户端按需动态聚合为：
- `1m`, `5m`, `15m` (短线)
- `1h` (趋势)
- `1d` (长线)

---

## 🏁 快速启动

1. **环境准备**:
   确保本地已安装 Node.js 18+ 和 npm。

2. **安装依赖**:
   ```bash
   cd my-app
   npm install
   ```

3. **配置变量**:
   在 `my-app` 目录下创建 `.env.local`:
   ```env
   MINIMAX_API_KEY=your_key_here
   ```

4. **运行开发服务器**:
   ```bash
   npm run dev
   ```

---

## ⚠️ 开发者注意事项

1. **DuckDB 连接单例**:
   由于 DuckDB 在热更新(HMR)时可能出现连接锁定，系统已在 `globalThis` 中实现了连接池单例化。如遇锁定错误，请重启开发服务器。
2. **API 频率限制**:
   CoinGecko 免费版限制为 30 次/分钟。系统已实现请求队列缓冲，但频繁刷页面仍可能触发 429。
3. **K 线对焦机制**:
   `KlinePriceChart` 组件包含复杂的初始对焦逻辑。修改 `useEffect` 时请注意不要破坏 `scrollToPosition(0)` 的首次锁定特性。

---

**由 TradeMind 构建**
*Focus on Execution, Powered by Intelligence*
