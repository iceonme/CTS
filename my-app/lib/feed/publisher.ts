/**
 * Feed 发布系统
 * 管理所有 Agent 的情报发布到 Feed 流
 */

import type { IntelligenceItem } from "@/lib/types";
import { getTechnicalAnalyst } from "@/lib/agents/tech-analyst";
import { getPolymarketAgent } from "@/lib/agents/polymarket-analyst";
import { getCFOAgent } from "@/lib/agents/cfo";
import { getPortfolioManager } from "@/lib/trading/portfolio";

// 存储所有 Feed 项（实际项目中应使用数据库）
let feedStore: IntelligenceItem[] = [];
const MAX_FEED_ITEMS = 100;

// 订阅者回调
type FeedSubscriber = (item: IntelligenceItem) => void;
const subscribers: FeedSubscriber[] = [];

/**
 * 发布情报到 Feed
 */
export function publishToFeed(item: IntelligenceItem): void {
  feedStore.unshift(item);
  
  // 限制存储数量
  if (feedStore.length > MAX_FEED_ITEMS) {
    feedStore = feedStore.slice(0, MAX_FEED_ITEMS);
  }
  
  // 通知订阅者
  subscribers.forEach(callback => {
    try {
      callback(item);
    } catch (error) {
      console.error("[FeedPublisher] 订阅者错误:", error);
    }
  });
  
  console.log(`[FeedPublisher] 已发布: ${item.title}`);
}

/**
 * 订阅 Feed 更新
 */
export function subscribeToFeed(callback: FeedSubscriber): () => void {
  subscribers.push(callback);
  
  // 返回取消订阅函数
  return () => {
    const index = subscribers.indexOf(callback);
    if (index > -1) {
      subscribers.splice(index, 1);
    }
  };
}

/**
 * 获取所有 Feed 项
 */
export function getFeedItems(
  options?: {
    limit?: number;
    symbol?: string;
    type?: string;
    importance?: string;
  }
): IntelligenceItem[] {
  let items = [...feedStore];
  
  if (options?.symbol) {
    items = items.filter(item => item.symbol === options.symbol);
  }
  
  if (options?.type) {
    items = items.filter(item => item.type === options.type);
  }
  
  if (options?.importance) {
    items = items.filter(item => item.importance === options.importance);
  }
  
  if (options?.limit) {
    items = items.slice(0, options.limit);
  }
  
  return items;
}

/**
 * 清空 Feed
 */
export function clearFeed(): void {
  feedStore = [];
  console.log("[FeedPublisher] Feed 已清空");
}

// ==================== Agent 定期发布任务 ====================

/**
 * 技术分析员每5分钟发布任务
 */
export async function runTechAnalystFeedJob(): Promise<void> {
  console.log("[FeedJob] 正在运行技术分析员 Feed 任务...");
  
  const techAnalyst = getTechnicalAnalyst();
  const portfolio = getPortfolioManager();
  
  try {
    // 分析 BTC 和 DOGE
    const result = await techAnalyst.processTask({
      id: `tech-feed-${Date.now()}`,
      type: "analyze_btc_doge",
      data: {},
      priority: "medium",
      createdAt: new Date(),
    });
    
    if (result.success && result.data) {
      const { analyses, prices } = result.data as { 
        analyses: Array<{
          symbol: string;
          indicators: {
            rsi: number;
            ma7: number;
            ma14: number;
            trend: string;
          };
          signals: Array<{
            type: string;
            confidence: number;
            description: string;
          }>;
          timestamp: Date;
        }>;
        prices: Array<{ symbol: string; price: number }>;
      };
      
      // 更新 Portfolio 中的价格
      if (prices) {
        prices.forEach(({ symbol, price }) => {
          portfolio.updatePrice(symbol, price);
        });
        console.log(`[FeedJob] 已更新 Portfolio 价格:`, prices.map(p => `${p.symbol}: $${p.price}`).join(', '));
      }
      
      // 为每个分析结果创建 Feed 项
      analyses.forEach(analysis => {
        const topSignal = analysis.signals[0];
        const importance = topSignal?.confidence > 0.7 ? "high" : 
                          topSignal?.confidence > 0.5 ? "medium" : "low";
        
        const item: IntelligenceItem = {
          id: `tech-${analysis.symbol}-${Date.now()}`,
          type: "technical_signal",
          title: `${analysis.symbol} 技术分析更新`,
          content: `RSI: ${analysis.indicators.rsi} | MA7: $${analysis.indicators.ma7.toFixed(2)} | 趋势: ${analysis.indicators.trend}\n` +
                   `信号: ${topSignal?.description || "暂无明确信号"}`,
          symbol: analysis.symbol,
          timestamp: new Date(),
          importance,
          data: {
            source: "tech-analyst",
            rsi: analysis.indicators.rsi,
            ma7: analysis.indicators.ma7,
            ma14: analysis.indicators.ma14,
            trend: analysis.indicators.trend,
            signalType: topSignal?.type,
            signalConfidence: topSignal?.confidence,
          },
        };
        
        publishToFeed(item);
      });
      
      console.log(`[FeedJob] 技术分析员已发布 ${analyses.length} 条情报`);
    }
  } catch (error) {
    console.error("[FeedJob] 技术分析员任务失败:", error);
  }
}

/**
 * Polymarket 专员每5分钟发布任务
 */
export async function runPolymarketFeedJob(): Promise<void> {
  console.log("[FeedJob] 正在运行 Polymarket Feed 任务...");
  
  const polymarketAgent = getPolymarketAgent();
  
  try {
    const items = await polymarketAgent.generateIntelligence();
    
    items.forEach(item => {
      publishToFeed(item);
    });
    
    console.log(`[FeedJob] Polymarket 已发布 ${items.length} 条情报`);
  } catch (error) {
    console.error("[FeedJob] Polymarket 任务失败:", error);
  }
}

/**
 * PA 每15分钟发布盯盘结果
 */
export async function runPAWatchJob(): Promise<void> {
  console.log("[FeedJob] 正在运行 PA 盯盘任务...");
  
  const cfo = getCFOAgent();
  
  try {
    // 分析 BTC 和 DOGE
    const analyses = await cfo.analyzeMultiple(["BTC", "DOGE"]);
    
    analyses.forEach(analysis => {
      const item: IntelligenceItem = {
        id: `pa-${analysis.symbol}-${Date.now()}`,
        type: "pa_analysis",
        title: `${analysis.symbol} PA 研判报告`,
        content: cfo.formatAnalysisForChat(analysis),
        symbol: analysis.symbol,
        timestamp: new Date(),
        importance: analysis.consensus.confidence > 0.7 ? "high" : "medium",
        data: {
          source: "pa",
          bullConfidence: analysis.perspectives.bull.confidence,
          bearConfidence: analysis.perspectives.bear.confidence,
          consensusSentiment: analysis.consensus.sentiment,
          consensusAction: analysis.consensus.action,
          consensusConfidence: analysis.consensus.confidence,
        },
      };
      
      publishToFeed(item);
    });
    
    console.log(`[FeedJob] PA 已发布 ${analyses.length} 条情报`);
  } catch (error) {
    console.error("[FeedJob] PA 任务失败:", error);
  }
}

// ==================== 调度器 ====================

let techInterval: NodeJS.Timeout | null = null;
let polymarketInterval: NodeJS.Timeout | null = null;
let cfoInterval: NodeJS.Timeout | null = null;

/**
 * 启动所有 Feed 定时任务
 */
export function startFeedScheduler(): void {
  console.log("[FeedScheduler] 正在启动...");
  
  // 立即执行一次
  runTechAnalystFeedJob();
  runPolymarketFeedJob();
  runPAWatchJob();
  
  // 技术分析员：每5分钟
  techInterval = setInterval(runTechAnalystFeedJob, 5 * 60 * 1000);
  
  // Polymarket：每5分钟
  polymarketInterval = setInterval(runPolymarketFeedJob, 5 * 60 * 1000);
  
  // PA：每15分钟
  cfoInterval = setInterval(runPAWatchJob, 15 * 60 * 1000);
  
  console.log("[FeedScheduler] 已启动 - 技术分析员: 5分钟, Polymarket: 5分钟, PA: 15分钟");
}

/**
 * 停止所有 Feed 定时任务
 */
export function stopFeedScheduler(): void {
  if (techInterval) clearInterval(techInterval);
  if (polymarketInterval) clearInterval(polymarketInterval);
  if (cfoInterval) clearInterval(cfoInterval);
  
  console.log("[FeedScheduler] 已停止");
}

/**
 * 手动触发所有任务（用于测试）
 */
export async function triggerAllJobs(): Promise<void> {
  await Promise.all([
    runTechAnalystFeedJob(),
    runPolymarketFeedJob(),
    runPAWatchJob(),
  ]);
}
