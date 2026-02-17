/**
 * CoinGecko API 封装
 * 免费版限制：50 calls/minute
 * @see https://www.coingecko.com/api/documentation
 */

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";

// 代理配置（仅在 Node.js 环境使用）
// 如果需要代理，请设置环境变量 HTTPS_PROXY，例如：
// HTTPS_PROXY=http://127.0.0.1:10808 npm run dev
const PROXY_URL = process.env.HTTPS_PROXY || process.env.https_proxy || "";
const USE_PROXY = !!PROXY_URL;

export interface CoinPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  last_updated: string;
}

export interface CoinMarketChart {
  prices: [number, number][]; // [timestamp, price]
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export interface CoinOHLC {
  // [timestamp, open, high, low, close]
  [index: number]: [number, number, number, number, number];
}

// 错误处理
class CoinGeckoError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = "CoinGeckoError";
  }
}

// 重试配置
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000; // 2秒

// 请求队列管理（限速保护）
class RequestQueue {
  private queue: (() => void)[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly minInterval = 1200; // 1.2秒间隔（50 req/min = 1.2s/req）

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // 限速控制
          const now = Date.now();
          const waitTime = Math.max(0, this.minInterval - (now - this.lastRequestTime));
          if (waitTime > 0) {
            await new Promise(r => setTimeout(r, waitTime));
          }
          this.lastRequestTime = Date.now();
          
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) await task();
    }
    this.processing = false;
  }
}

const requestQueue = new RequestQueue();

// 动态导入 node-fetch 和 https-proxy-agent（仅在服务器端）
async function getFetch() {
  if (typeof window === "undefined") {
    // 服务器端：使用 node-fetch
    const { default: nodeFetch } = await import("node-fetch");
    return nodeFetch;
  }
  // 浏览器端：使用原生 fetch
  return fetch;
}

async function getProxyAgent() {
  if (typeof window === "undefined" && USE_PROXY) {
    try {
      const { HttpsProxyAgent } = await import("https-proxy-agent");
      return new HttpsProxyAgent(PROXY_URL);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// 基础请求函数（带重试）
async function fetchCoinGecko<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  return requestQueue.add(async () => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // 重试延迟（指数退避）
        if (attempt > 0) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
          console.log(`[CoinGecko] 重试 ${attempt + 1}/${MAX_RETRIES}，等待 ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
        
        const url = new URL(`${COINGECKO_API_BASE}${endpoint}`);
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
          });
        }

        // 构建 fetch 选项
        const fetchOptions: RequestInit = {
          headers: {
            "Accept": "application/json",
          },
        };

        // 在 Node.js 环境中添加代理
        if (typeof window === "undefined") {
          const agent = await getProxyAgent();
          if (agent) {
            (fetchOptions as Record<string, unknown>).agent = agent;
          }
        }

        const fetchFn = await getFetch();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await fetchFn(url.toString(), fetchOptions as any);

        if (!response.ok) {
          if (response.status === 429) {
            lastError = new CoinGeckoError("API 限速，稍等重试", 429);
            continue; // 继续重试
          }
          const errorText = await response.text();
          throw new CoinGeckoError(
            `CoinGecko API error: ${response.status} - ${errorText}`,
            response.status
          );
        }

        return await response.json() as T;
      } catch (error) {
        if (error instanceof CoinGeckoError && error.statusCode === 429) {
          lastError = error;
          continue; // 继续重试
        }
        throw error; // 其他错误直接抛出
      }
    }
    
    // 所有重试都失败了
    throw lastError || new CoinGeckoError("请求失败，请稍后再试");
  });
}

// ==================== API 方法 ====================

/**
 * 获取多个币种的当前市场价格
 * @param ids 币种ID数组，如 ["bitcoin", "dogecoin"]
 * @param vsCurrency 计价货币，默认 "usd"
 */
export async function getCoinPrices(
  ids: string[],
  vsCurrency: string = "usd"
): Promise<CoinPrice[]> {
  return fetchCoinGecko<CoinPrice[]>("/coins/markets", {
    vs_currency: vsCurrency,
    ids: ids.join(","),
    order: "market_cap_desc",
    per_page: ids.length.toString(),
    page: "1",
    sparkline: "false",
    price_change_percentage: "24h",
  });
}

/**
 * 获取单个币种的历史价格数据
 * @param id 币种ID，如 "bitcoin"
 * @param days 天数（1, 7, 14, 30, 90, 180, 365, max）
 * @param vsCurrency 计价货币
 */
export async function getCoinMarketChart(
  id: string,
  days: string = "7",
  vsCurrency: string = "usd"
): Promise<CoinMarketChart> {
  return fetchCoinGecko<CoinMarketChart>(`/coins/${id}/market_chart`, {
    vs_currency: vsCurrency,
    days,
  });
}

/**
 * 获取 OHLC 数据（用于技术分析）
 * @param id 币种ID
 * @param days 天数（1, 7, 14, 30, 90, 180, 365）
 * @param vsCurrency 计价货币
 */
export async function getCoinOHLC(
  id: string,
  days: string = "7",
  vsCurrency: string = "usd"
): Promise<[number, number, number, number, number][]> {
  return fetchCoinGecko<[number, number, number, number, number][]>(
    `/coins/${id}/ohlc`,
    {
      vs_currency: vsCurrency,
      days,
    }
  );
}

/**
 * 获取支持的币种列表
 * @param includePlatform 是否包含平台信息
 */
export async function getCoinsList(includePlatform: boolean = false): Promise<
  { id: string; symbol: string; name: string; platforms?: Record<string, string> }[]
> {
  return fetchCoinGecko(`/coins/list`, {
    include_platform: includePlatform.toString(),
  });
}

/**
 * 获取趋势币种（热门搜索）
 */
export async function getTrendingCoins(): Promise<{
  coins: {
    item: {
      id: string;
      coin_id: number;
      name: string;
      symbol: string;
      market_cap_rank: number;
      thumb: string;
      small: string;
      large: string;
      slug: string;
      price_btc: number;
      score: number;
    };
  }[];
}> {
  return fetchCoinGecko("/search/trending");
}

/**
 * 搜索币种
 * @param query 搜索关键词
 */
export async function searchCoins(query: string): Promise<{
  coins: {
    id: string;
    name: string;
    symbol: string;
    market_cap_rank: number;
    thumb: string;
    large: string;
  }[];
}> {
  return fetchCoinGecko("/search", { query });
}

// ==================== 常用币种快捷方法 ====================

const COMMON_COINS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  DOGE: "dogecoin",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
} as const;

export type CommonCoinSymbol = keyof typeof COMMON_COINS;

/**
 * 获取常用币种价格
 */
export async function getCommonCoinPrices(
  symbols: CommonCoinSymbol[] = ["BTC", "DOGE"]
): Promise<CoinPrice[]> {
  const ids = symbols.map(s => COMMON_COINS[s]);
  return getCoinPrices(ids);
}

/**
 * 获取 BTC 和 DOGE 的价格和技术数据
 * 用于定时任务
 */
export async function getBTCAndDOGEData(): Promise<{
  prices: CoinPrice[];
  btcChart: CoinMarketChart;
  dogeChart: CoinMarketChart;
}> {
  const [prices, btcChart, dogeChart] = await Promise.all([
    getCommonCoinPrices(["BTC", "DOGE"]),
    getCoinMarketChart("bitcoin", "14"), // 14天数据用于计算MA
    getCoinMarketChart("dogecoin", "14"),
  ]);

  return { prices, btcChart, dogeChart };
}

export { CoinGeckoError, COMMON_COINS };
export default {
  getCoinPrices,
  getCoinMarketChart,
  getCoinOHLC,
  getCoinsList,
  getTrendingCoins,
  searchCoins,
  getCommonCoinPrices,
  getBTCAndDOGEData,
};
