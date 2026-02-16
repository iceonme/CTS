/**
 * CoinGecko Tools
 * MCP 风格的 CoinGecko API 工具集
 */

import type { Tool } from '../types';
import { getCoinPrices, getCoinMarketChart, getBTCAndDOGEData } from '@/lib/data/coingecko';

export const CoinGeckoPriceTool: Tool = {
  id: 'coingecko:get_price',
  name: '获取币种价格',
  description: '获取指定币种的当前价格、24小时涨跌幅、市值等数据',
  parameters: {
    type: 'object',
    properties: {
      symbols: {
        type: 'array',
        items: { type: 'string' },
        description: '币种符号列表，如 ["BTC", "ETH"]',
      },
    },
    required: ['symbols'],
  },
  execute: async (params: { symbols: string[] }) => {
    const ids = params.symbols.map(s => {
      const map: Record<string, string> = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'DOGE': 'dogecoin',
        'SOL': 'solana',
      };
      return map[s] || s.toLowerCase();
    });
    
    return getCoinPrices(ids);
  },
};

export const CoinGeckoChartTool: Tool = {
  id: 'coingecko:get_chart',
  name: '获取历史价格数据',
  description: '获取币种的历史价格、成交量数据，用于技术分析',
  parameters: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: '币种符号，如 "BTC"',
      },
      days: {
        type: 'number',
        description: '天数 (1, 7, 14, 30, 90, 365)',
        default: 14,
      },
    },
    required: ['symbol'],
  },
  execute: async (params: { symbol: string; days?: number }) => {
    const idMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'DOGE': 'dogecoin',
      'SOL': 'solana',
    };
    const id = idMap[params.symbol] || params.symbol.toLowerCase();
    return getCoinMarketChart(id, String(params.days || 14));
  },
};

export const CoinGeckoBTCDOGETool: Tool = {
  id: 'coingecko:get_btc_doge',
  name: '获取 BTC/DOGE 数据',
  description: '同时获取 BTC 和 DOGE 的价格和图表数据',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async () => {
    return getBTCAndDOGEData();
  },
};

// 导出所有 CoinGecko Tools
export const CoinGeckoTools = [
  CoinGeckoPriceTool,
  CoinGeckoChartTool,
  CoinGeckoBTCDOGETool,
];

export default CoinGeckoTools;
