/**
 * 交易相关 Tools (简化版)
 * 
 * 只提供底层能力，不做策略判断：
 * - portfolio:trade - 执行交易
 * - portfolio:get - 获取持仓
 * - coingecko:price - 获取价格
 */

import { getPortfolioManager } from '@/lib/trading/portfolio';
import { getCommonCoinPrices, type CommonCoinSymbol } from '@/lib/data/coingecko';
import type { Tool } from '../types';

/**
 * 执行交易 Tool
 */
export const PortfolioTradeTool: Tool = {
  id: 'portfolio:trade',
  name: '执行交易',
  description: '执行买入或卖出交易',
  parameters: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: '交易币种' },
      side: { type: 'string', enum: ['buy', 'sell'], description: '买入或卖出' },
      type: { type: 'string', enum: ['market', 'limit'], description: '市价单或限价单' },
      quantity: { type: 'number', description: '交易数量' },
      price: { type: 'number', description: '限价单价格（可选）' },
      notes: { type: 'string', description: '交易备注（可选）' },
    },
    required: ['symbol', 'side', 'type', 'quantity'],
  },
  
  execute: async (params: {
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit';
    quantity: number;
    price?: number;
    notes?: string;
  }) => {
    const portfolio = getPortfolioManager();
    
    const result = portfolio.executeTrade({
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      quantity: params.quantity,
      price: params.price,
      notes: params.notes,
    });

    return result;
  },
};

/**
 * 获取 Portfolio Tool
 */
export const PortfolioGetTool: Tool = {
  id: 'portfolio:get',
  name: '获取投资组合',
  description: '获取当前持仓、余额和盈亏信息',
  parameters: {
    type: 'object',
    properties: {},
  },
  
  execute: async () => {
    const portfolio = getPortfolioManager();
    return portfolio.getPortfolio();
  },
};

/**
 * 获取价格 Tool
 */
export const CoinGeckoPriceTool: Tool = {
  id: 'coingecko:price',
  name: '获取价格',
  description: '从 CoinGecko 获取币种当前价格',
  parameters: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: '币种符号 (BTC, ETH, DOGE等)' },
    },
    required: ['symbol'],
  },
  
  execute: async (params: { symbol: string }) => {
    const validSymbols: CommonCoinSymbol[] = ['BTC', 'ETH', 'DOGE', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK'];
    const upperSymbol = params.symbol.toUpperCase() as CommonCoinSymbol;
    
    if (!validSymbols.includes(upperSymbol)) {
      throw new Error(`不支持的币种: ${params.symbol}`);
    }
    
    const prices = await getCommonCoinPrices([upperSymbol]);
    if (prices && prices.length > 0) {
      return prices[0].current_price;
    }
    throw new Error('无法获取价格');
  },
};

/**
 * 批量获取价格 Tool
 */
export const CoinGeckoPricesTool: Tool = {
  id: 'coingecko:prices',
  name: '批量获取价格',
  description: '从 CoinGecko 批量获取多个币种价格',
  parameters: {
    type: 'object',
    properties: {
      symbols: { 
        type: 'array', 
        items: { type: 'string' },
        description: '币种符号数组' 
      },
    },
    required: ['symbols'],
  },
  
  execute: async (params: { symbols: string[] }) => {
    const validSymbols: CommonCoinSymbol[] = ['BTC', 'ETH', 'DOGE', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK'];
    const symbols = params.symbols
      .map(s => s.toUpperCase() as CommonCoinSymbol)
      .filter(s => validSymbols.includes(s));
    
    if (symbols.length === 0) {
      throw new Error('没有有效的币种');
    }
    
    const prices = await getCommonCoinPrices(symbols);
    return prices.map(p => ({
      symbol: p.symbol.toUpperCase(),
      price: p.current_price,
      change24h: p.price_change_percentage_24h,
    }));
  },
};

// 导出所有交易 Tools
export const tradingTools = [
  PortfolioTradeTool,
  PortfolioGetTool,
  CoinGeckoPriceTool,
  CoinGeckoPricesTool,
];

export default tradingTools;
