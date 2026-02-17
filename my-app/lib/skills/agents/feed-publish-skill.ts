/**
 * Feed 发布 Skill
 * 
 * 这是一个通用 Skill，所有情报 Agent 都可以使用它来发布 Feed。
 * 但不同角色的 Agent 可以配置不同的:
 * - feedType: 情报类型 (technical/sentiment/prediction/pa_decision)
 * - template: 发布内容的模板
 * - importance: 默认重要性
 * 
 * 设计理念: "一个 Skill，多种形态"
 */

import type { Skill, SkillContext, SkillResult, FeedItem, FeedPublishConfig } from '../types';

// Feed 存储 (实际项目中应该是数据库或 Redis)
let feedStore: FeedItem[] = [];
const MAX_FEED_ITEMS = 100;

// Feed 订阅者回调
type FeedSubscriber = (item: FeedItem) => void;
const subscribers: FeedSubscriber[] = [];

/**
 * 创建 Feed 发布 Skill
 * 
 * @param config - Feed 发布配置
 * @returns Skill 实例
 */
export function createFeedPublishSkill(config: FeedPublishConfig): Skill {
  return {
    // ========== 元数据 ==========
    id: `feed:publish:${config.feedType}`,
    name: '发布情报',
    description: `发布 ${config.feedType} 类型的情报到 Feed 流`,
    category: 'communication',
    version: '1.0.0',

    // ========== 核心指令 ==========
    instructions: {
      system: `你是一个情报发布专家。你的任务是将分析结果格式化为标准的情报项，并发布到 Feed 流。

发布规则:
1. 标题要简洁明了，突出关键信息
2. 内容要结构化，便于阅读
3. 正确设置重要性级别
4. 附加相关数据便于后续分析`,
      
      constraints: [
        '标题不能超过 50 个字符',
        '内容必须包含关键结论',
        '必须设置正确的情报类型',
        '时间戳使用 ISO 格式',
      ],
    },

    // ========== 工具依赖 ==========
    tools: {
      required: [],
      optional: [],
    },

    // ========== 输入/输出 ==========
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '情报标题' },
        content: { type: 'string', description: '情报内容' },
        symbol: { type: 'string', description: '相关币种' },
        importance: { 
          type: 'string', 
          enum: ['low', 'medium', 'high', 'critical'],
          description: '重要性级别' 
        },
        data: { type: 'object', description: '附加数据' },
      },
      required: ['title', 'content'],
    },

    outputSchema: {
      type: 'object',
      properties: {
        feedId: { type: 'string' },
        published: { type: 'boolean' },
      },
      required: ['feedId', 'published'],
    },

    // ========== 参考资料 ==========
    references: {
      templates: {
        [config.templateKey]: getTemplateForType(config.feedType),
      },
    },

    // ========== 执行函数 ==========
    execute: async (context: SkillContext): Promise<SkillResult> => {
      const input = context.input;
      const agent = context.agent;

      try {
        // 构建 FeedItem
        const feedItem: FeedItem = {
          id: `feed-${config.feedType}-${Date.now()}`,
          type: mapFeedType(config.feedType),
          title: input.title,
          content: input.content,
          publisher: {
            agentId: agent.id,
            agentName: agent.name,
            agentAvatar: getAvatarForRole(agent.role),
            skillId: `feed:publish:${config.feedType}`,
          },
          symbol: input.symbol,
          timestamp: new Date(),
          importance: input.importance || config.defaultImportance,
          data: input.data,
        };

        // 存储到 Feed Store
        feedStore.unshift(feedItem);
        if (feedStore.length > MAX_FEED_ITEMS) {
          feedStore = feedStore.slice(0, MAX_FEED_ITEMS);
        }

        // 通知订阅者
        subscribers.forEach(callback => {
          try {
            callback(feedItem);
          } catch (error) {
            console.error('[FeedPublishSkill] Subscriber error:', error);
          }
        });

        console.log(`[FeedPublishSkill] Published: ${feedItem.title} (${config.feedType})`);

        return {
          success: true,
          data: {
            feedId: feedItem.id,
            published: true,
            feedItem,
          },
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMsg,
        };
      }
    },
  };
}

// ==================== 辅助函数 ====================

function getTemplateForType(feedType: string): string {
  const templates: Record<string, string> = {
    'technical': '📊 **{symbol} 技术分析**\n\n{content}\n\n关键指标: {indicators}',
    'sentiment': '🔮 **预测市场情报**\n\n{title}\n\n当前概率: {probability}',
    'prediction': '🎯 **事件预测**\n\n{title}\n\n趋势: {trend}',
    'pa_decision': '{avatar} **{paName} 研判**\n\n{symbol}: {decision}\n\n🐂 Bull: {bullConfidence}% | 🐻 Bear: {bearConfidence}%',
    // 保留旧名称以兼容
    'cfo_decision': '👔 **PA 研判**\n\n{symbol}: {decision}\n\n🐂 Bull: {bullConfidence}% | 🐻 Bear: {bearConfidence}%',
  };
  return templates[feedType] || '{title}\n\n{content}';
}

function mapFeedType(feedType: string): FeedItem['type'] {
  const map: Record<string, FeedItem['type']> = {
    'technical': 'analysis',
    'sentiment': 'signal',
    'prediction': 'alert',
    'pa_decision': 'report',
    'cfo_decision': 'report', // 兼容旧名称
  };
  return map[feedType] || 'analysis';
}

function getAvatarForRole(role: string): string {
  const avatars: Record<string, string> = {
    'pa': '🤖',  // PA 助手
    'cfo': '👔', // 兼容旧角色
    'analyst': '📊',
    'specialist': '🔮',
    'tech-analyst': '📊',
    'prediction-analyst': '🔮',
  };
  return avatars[role] || '🤖';
}

// ==================== Feed 订阅 API ====================

export function subscribeToFeed(callback: FeedSubscriber): () => void {
  subscribers.push(callback);
  return () => {
    const index = subscribers.indexOf(callback);
    if (index > -1) {
      subscribers.splice(index, 1);
    }
  };
}

export function getFeedItems(limit?: number): FeedItem[] {
  return limit ? feedStore.slice(0, limit) : [...feedStore];
}

export function clearFeed(): void {
  feedStore = [];
}

// ==================== 预定义的 Feed 发布 Skill 配置 ====================

export const TechAnalystFeedConfig: FeedPublishConfig = {
  feedType: 'technical',
  defaultImportance: 'medium',
  templateKey: 'technical',
  channels: ['war-room', 'feed'],
};

export const PolymarketFeedConfig: FeedPublishConfig = {
  feedType: 'sentiment',
  defaultImportance: 'medium',
  templateKey: 'sentiment',
  channels: ['war-room', 'feed'],
};

// 新的 PA 配置 (推荐)
export const PAFeedConfig: FeedPublishConfig = {
  feedType: 'pa_decision',
  defaultImportance: 'high',
  templateKey: 'pa_decision',
  channels: ['war-room', 'feed', 'alert'],
};

// 保留旧名称以兼容
/** @deprecated 使用 PAFeedConfig */
export const CFOFeedConfig: FeedPublishConfig = PAFeedConfig;

// 导出预设的 Skill 实例
export const TechAnalystFeedSkill = createFeedPublishSkill(TechAnalystFeedConfig);
export const PolymarketFeedSkill = createFeedPublishSkill(PolymarketFeedConfig);
export const PAFeedSkill = createFeedPublishSkill(PAFeedConfig);

// 保留旧名称以兼容
/** @deprecated 使用 PAFeedSkill */
export const CFOFeedSkill = PAFeedSkill;
