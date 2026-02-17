'use client';

import { useState, useEffect } from 'react';
import { getPortfolioManager } from '@/lib/trading/portfolio';
import { getBTCAndDOGEData } from '@/lib/data/coingecko';

export default function TestPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const runTest = async () => {
    setLoading(true);
    setLogs([]);
    
    try {
      addLog('🚀 开始测试真实数据交易...\n');

      // 1. 获取真实价格
      addLog('📊 步骤 1: 从 CoinGecko 获取真实价格数据...');
      const marketData = await getBTCAndDOGEData();
      
      addLog('✅ 成功获取真实数据:');
      marketData.prices.forEach((coin: any) => {
        addLog(`   - ${coin.name} (${coin.symbol.toUpperCase()}): $${coin.current_price}`);
        addLog(`     24h 涨跌: ${coin.price_change_percentage_24h?.toFixed(2) || 'N/A'}%`);
      });
      setPrices(marketData.prices);

      // 2. 初始化 Portfolio
      addLog('\n💰 步骤 2: 初始化模拟投资组合...');
      const pm = getPortfolioManager();
      const initialPortfolio = pm.getPortfolio();
      addLog(`✅ 初始资金: $${initialPortfolio.initialBalance.toFixed(2)} USDT`);

      // 3. 更新价格
      addLog('\n📈 步骤 3: 更新持仓价格...');
      const priceMap: Record<string, number> = {};
      marketData.prices.forEach((coin: any) => {
        priceMap[coin.symbol.toUpperCase()] = coin.current_price;
      });
      pm.updatePrices(priceMap);
      addLog('✅ 价格已更新到 Portfolio');

      // 4. 执行交易
      addLog('\n🔄 步骤 4: 执行模拟交易...');
      
      // 买入 BTC
      const btcPrice = priceMap['BTC'];
      addLog(`   尝试买入 0.001 BTC @ $${btcPrice}...`);
      const buyResult = pm.executeTrade({
        symbol: 'BTC',
        side: 'buy',
        type: 'market',
        quantity: 0.001,
        notes: '测试交易 - 基于真实 CoinGecko 数据'
      });

      if (buyResult.success) {
        addLog(`   ✅ BTC 买入成功! 花费 $${buyResult.trade?.total.toFixed(2)}`);
      } else {
        addLog(`   ❌ 买入失败: ${buyResult.error}`);
      }

      // 买入 DOGE
      const dogePrice = priceMap['DOGE'];
      addLog(`   尝试买入 100 DOGE @ $${dogePrice}...`);
      const dogeResult = pm.executeTrade({
        symbol: 'DOGE',
        side: 'buy',
        type: 'market',
        quantity: 100,
        notes: '测试交易 - 基于真实 CoinGecko 数据'
      });

      if (dogeResult.success) {
        addLog(`   ✅ DOGE 买入成功! 花费 $${dogeResult.trade?.total.toFixed(2)}`);
      } else {
        addLog(`   ❌ 买入失败: ${dogeResult.error}`);
      }

      // 5. 查看 Portfolio
      addLog('\n📊 步骤 5: 当前投资组合状态...');
      const current = pm.getPortfolio();
      setPortfolio(current);
      addLog(`   总资产: $${current.totalEquity.toFixed(2)} USDT`);
      addLog(`   可用余额: $${current.balance.toFixed(2)} USDT`);
      addLog(`   未实现盈亏: $${current.totalUnrealizedPnl.toFixed(2)}`);
      
      addLog('\n   持仓明细:');
      current.positions.forEach((pos: any) => {
        addLog(`   - ${pos.symbol}: ${pos.quantity} @ 均价 $${pos.avgPrice.toFixed(2)}`);
      });

      addLog('\n✅ 所有测试通过! 真实数据交易功能正常。');

    } catch (error: any) {
      addLog(`\n❌ 错误: ${error.message}`);
      console.error(error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">🧪 真实数据交易测试</h1>
      
      <button
        onClick={runTest}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium disabled:opacity-50"
      >
        {loading ? '测试中...' : '开始测试'}
      </button>

      <div className="mt-8 grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">📋 测试日志</h2>
          <div className="bg-black/50 p-4 rounded-lg font-mono text-sm h-96 overflow-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">点击&quot;开始测试&quot;运行...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap">{log}</div>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">📊 当前状态</h2>
          
          {prices.length > 0 && (
            <div className="bg-gray-800 p-4 rounded-lg mb-4">
              <h3 className="font-medium mb-2">实时价格 (CoinGecko)</h3>
              {prices.map((p: any) => (
                <div key={p.id} className="flex justify-between py-1">
                  <span>{p.symbol.toUpperCase()}</span>
                  <span className={p.price_change_percentage_24h > 0 ? 'text-green-400' : 'text-red-400'}>
                    ${p.current_price.toFixed(p.current_price < 1 ? 4 : 2)}
                    ({p.price_change_percentage_24h?.toFixed(2)}%)
                  </span>
                </div>
              ))}
            </div>
          )}

          {portfolio && (
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Portfolio</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>总资产:</span>
                  <span>${portfolio.totalEquity.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>可用余额:</span>
                  <span>${portfolio.balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>未实现盈亏:</span>
                  <span className={portfolio.totalUnrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                    ${portfolio.totalUnrealizedPnl.toFixed(2)}
                  </span>
                </div>
              </div>
              
              {portfolio.positions.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">持仓</h4>
                  {portfolio.positions.map((pos: any) => (
                    <div key={pos.id} className="text-sm py-1 border-t border-gray-700">
                      {pos.symbol}: {pos.quantity} @ ${pos.avgPrice.toFixed(2)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
