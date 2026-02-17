"use client";

import { useState, useRef, useEffect } from "react";
import { getCFOAgent } from "@/lib/agents/cfo";
import { getPortfolioManager } from "@/lib/trading/portfolio";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: {
    type?: "analysis" | "trade" | "report" | "alert";
    symbol?: string;
    confidence?: number;
    bullConfidence?: number;
    bearConfidence?: number;
    action?: string;
  };
}

interface ChatInterfaceProps {
  paName?: string;
  paAvatar?: string;
  paPersonality?: string;
}

// 客户端时间显示组件 - 避免 Hydration 错误
function TimeDisplay({ date }: { date: Date }) {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    // 只在客户端格式化时间
    setTimeStr(date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }));
  }, [date]);

  return <>{timeStr}</>;
}

export default function ChatInterface({
  paName = "投资助手",
  paAvatar = "🤖",
  paPersonality = "专业简洁",
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `**${paAvatar} ${paName}**

您好，我是您的${paName}。我可以帮您：

📊 **市场分析** - 分析 BTC、DOGE 等币种
🌍 **市场概览** - 查看整体市场状况  
💰 **交易执行** - 模拟交易操作
📈 **盈亏查询** - 查看投资组合

请直接输入您想了解的内容。`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 当 paName 变化时更新欢迎消息
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `**${paAvatar} ${paName}**

您好，我是您的${paName}。我可以帮您：

📊 **市场分析** - 分析 BTC、DOGE 等币种
🌍 **市场概览** - 查看整体市场状况  
💰 **交易执行** - 模拟交易操作
📈 **盈亏查询** - 查看投资组合

请直接输入您想了解的内容。`,
        timestamp: new Date(),
      },
    ]);
  }, [paName, paAvatar]);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await processCommand(input);
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.content,
        timestamp: new Date(),
        metadata: response.metadata,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "system",
        content: "抱歉，处理请求时出现错误，请稍后再试。",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理用户命令
  const processCommand = async (command: string): Promise<{ content: string; metadata?: any }> => {
    const lowerCmd = command.toLowerCase();
    const agent = getCFOAgent();

    // 交易命令
    if (lowerCmd.includes("买入") || lowerCmd.includes("buy")) {
      const match = command.match(/(买入|buy)\s*(\w+)\s*(\d*\.?\d*)/i);
      if (match) {
        const symbol = match[2].toUpperCase();
        const amount = parseFloat(match[3]) || 100;
        return executeTrade(symbol, "buy", amount);
      }
    }

    if (lowerCmd.includes("卖出") || lowerCmd.includes("sell")) {
      const match = command.match(/(卖出|sell)\s*(\w+)\s*(\d*\.?\d*)/i);
      if (match) {
        const symbol = match[2].toUpperCase();
        const amount = parseFloat(match[3]) || 0;
        return executeTrade(symbol, "sell", amount);
      }
    }

    // 持仓查询
    if (lowerCmd.includes("持仓") || lowerCmd.includes("position") || lowerCmd.includes("portfolio")) {
      return getPortfolioInfo();
    }

    // 交易历史
    if (lowerCmd.includes("历史") || lowerCmd.includes("history") || lowerCmd.includes("交易记录")) {
      return getTradeHistory();
    }

    // 基于 Feed 的交易建议
    if (lowerCmd.includes("feed") || lowerCmd.includes("情报") || lowerCmd.includes("建议") || lowerCmd.includes("交易建议")) {
      try {
        const recommendations = await agent.analyzeFromFeed();
        let response = `📊 **基于最新情报的交易建议**\n\n`;
        recommendations.forEach((rec, index) => {
          response += agent.formatTradeRecommendation(rec);
          if (index < recommendations.length - 1) {
            response += "\n\n---\n\n";
          }
        });
        return {
          content: response,
          metadata: { type: "trade_recommendation", recommendations },
        };
      } catch (error) {
        return { content: "获取交易建议时出现错误，请稍后再试。" };
      }
    }

    // 市场概览
    if (lowerCmd.includes("市场") || lowerCmd.includes("market") || lowerCmd.includes("概览")) {
      const overview = await agent.getMarketOverview();
      return { content: agent.formatMarketOverview(overview) };
    }

    // 特定币种分析
    const symbolMatch = command.match(/\b(BTC|DOGE|ETH|SOL)\b/i);
    if (symbolMatch) {
      const symbol = symbolMatch[0].toUpperCase();
      try {
        const analysis = await agent.analyzeSymbol(symbol);
        return {
          content: agent.formatAnalysisForChat(analysis),
          metadata: {
            type: "analysis",
            symbol,
            confidence: analysis.consensus.confidence,
            bullConfidence: analysis.perspectives.bull.confidence,
            bearConfidence: analysis.perspectives.bear.confidence,
            action: analysis.consensus.action,
          },
        };
      } catch (error) {
        return { content: `暂时无法分析 ${symbol}，请稍后再试。` };
      }
    }

    // 默认使用 AI 聊天
    const response = await agent.chat(command);
    return { content: response };
  };

  // 执行交易
  const executeTrade = (symbol: string, side: "buy" | "sell", amount: number): { content: string; metadata?: any } => {
    const portfolio = getPortfolioManager();
    const currentPrice = 50000;
    const quantity = amount / currentPrice;

    const result = portfolio.executeTrade({
      symbol,
      side,
      type: "market",
      quantity,
      notes: `通过 ${paName} 执行`,
    });

    if (result.success && result.trade) {
      const trade = result.trade;
      return {
        content: `✅ **交易执行成功**\n\n` +
                 `**${side === "buy" ? "买入" : "卖出"}** ${symbol}\n` +
                 `数量: ${quantity.toFixed(6)}\n` +
                 `价格: $${trade.price.toLocaleString()}\n` +
                 `金额: $${trade.total.toFixed(2)}\n` +
                 `手续费: $${trade.fee.toFixed(2)}\n\n` +
                 `${trade.realizedPnl !== undefined 
                   ? `已实现盈亏: ${trade.realizedPnl >= 0 ? "+" : ""}$${trade.realizedPnl.toFixed(2)}` 
                   : ""}`,
        metadata: { type: "trade", symbol },
      };
    } else {
      return { content: `❌ **交易失败**\n\n${result.error}` };
    }
  };

  // 获取持仓信息
  const getPortfolioInfo = (): { content: string; metadata?: any } => {
    const portfolio = getPortfolioManager();
    const data = portfolio.getPortfolio();
    const positions = portfolio.getPositions();
    const stats = portfolio.getStats();

    let content = `💰 **投资组合概览**\n\n`;
    content += `初始资金: $${data.initialBalance.toLocaleString()}\n`;
    content += `可用资金: $${data.balance.toFixed(2)}\n`;
    content += `总资产: $${data.totalEquity.toFixed(2)}\n`;
    content += `总盈亏: ${data.totalReturn >= 0 ? "+" : ""}$${data.totalReturn.toFixed(2)} (${data.totalReturnPercent.toFixed(2)}%)\n\n`;

    if (positions.length > 0) {
      content += `**持仓明细:**\n`;
      positions.forEach(pos => {
        const emoji = pos.unrealizedPnl >= 0 ? "🟢" : "🔴";
        content += `${emoji} **${pos.symbol}**: ${pos.quantity.toFixed(6)} @ $${pos.avgPrice.toFixed(2)}\n`;
        content += `   现价: $${pos.currentPrice.toFixed(2)} | 浮动盈亏: ${pos.unrealizedPnl >= 0 ? "+" : ""}$${pos.unrealizedPnl.toFixed(2)} (${pos.unrealizedPnlPercent.toFixed(2)}%)\n`;
      });
    } else {
      content += `当前无持仓。`;
    }

    content += `\n**交易统计:**\n`;
    content += `总交易次数: ${stats.totalTrades}\n`;
    content += `胜率: ${stats.winRate.toFixed(1)}%\n`;

    return { content, metadata: { type: "report" } };
  };

  // 获取交易历史
  const getTradeHistory = (): { content: string; metadata?: any } => {
    const portfolio = getPortfolioManager();
    const trades = portfolio.getTrades(10);

    if (trades.length === 0) {
      return { content: "暂无交易记录。" };
    }

    let content = `📜 **最近交易记录**\n\n`;
    trades.forEach((trade, index) => {
      const emoji = trade.side === "buy" ? "🟢" : "🔴";
      const pnl = trade.realizedPnl !== undefined 
        ? ` | 盈亏: ${trade.realizedPnl >= 0 ? "+" : ""}$${trade.realizedPnl.toFixed(2)}`
        : "";
      content += `${index + 1}. ${emoji} **${trade.side === "buy" ? "买入" : "卖出"}** ${trade.symbol}\n`;
      content += `   ${trade.quantity.toFixed(6)} @ $${trade.price.toFixed(2)}${pnl}\n`;
      content += `   ${trade.createdAt.toLocaleString()}\n\n`;
    });

    return { content, metadata: { type: "report" } };
  };

  // 快捷操作按钮
  const quickActions = [
    { label: "📊 BTC分析", command: "分析 BTC" },
    { label: "🐕 DOGE分析", command: "分析 DOGE" },
    { label: "📰 交易建议", command: "查看交易建议" },
    { label: "💰 持仓", command: "查看持仓" },
    { label: "🌍 市场概览", command: "市场概览" },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{paAvatar}</span>
          <div>
            <h2 className="font-semibold text-white">{paName}</h2>
            <p className="text-xs text-gray-400">{paPersonality} · 数据驱动</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-xs text-green-500">在线</span>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : msg.role === "system"
                  ? "bg-gray-700 text-gray-300"
                  : "bg-gray-800 text-gray-100"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{paAvatar}</span>
                  <span className="text-xs font-medium text-blue-400">{paName}</span>
                  {msg.metadata?.confidence && (
                    <span className="text-xs px-2 py-0.5 bg-blue-900 rounded">
                      置信度 {(msg.metadata.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              )}
              
              {/* Bull/Bear 指示器 */}
              {msg.metadata?.bullConfidence !== undefined && msg.metadata?.bearConfidence !== undefined && (
                <div className="flex gap-2 mb-2">
                  <div className="flex-1 bg-green-900/50 rounded p-1 text-center">
                    <div className="text-xs text-green-400">🐂 Bull</div>
                    <div className="text-sm font-bold text-green-300">
                      {((msg.metadata.bullConfidence || 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="flex-1 bg-red-900/50 rounded p-1 text-center">
                    <div className="text-xs text-red-400">🐻 Bear</div>
                    <div className="text-sm font-bold text-red-300">
                      {((msg.metadata.bearConfidence || 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              )}

              {/* 消息内容 */}
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {msg.content}
              </div>

              {/* 操作按钮 */}
              {msg.metadata?.action && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setInput(`买入 ${msg.metadata?.symbol} 100`)}
                    className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded"
                  >
                    买入
                  </button>
                  <button
                    onClick={() => setInput(`卖出 ${msg.metadata?.symbol}`)}
                    className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
                  >
                    卖出
                  </button>
                </div>
              )}

              <div className="text-right mt-1">
                <span className="text-xs opacity-50">
                  <TimeDisplay date={msg.timestamp} />
                </span>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">{paAvatar}</span>
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 快捷操作 */}
      <div className="px-4 py-2 border-t border-gray-800 flex gap-2 overflow-x-auto">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => {
              setInput(action.command);
            }}
            className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded-full whitespace-nowrap transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* 输入框 */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={`输入消息，例如：分析 BTC、买入 BTC 100、查看持仓...`}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
