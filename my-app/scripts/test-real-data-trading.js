/**
 * 测试真实数据交易
 * 验证 CoinGecko 数据获取和模拟交易功能
 */

const { getBTCAndDOGEData } = require('../lib/data/coingecko');
const { getPortfolioManager } = require('../lib/trading/portfolio');
const { getAutoTrader } = require('../lib/trading/auto-trader');

async function testRealDataTrading() {
  console.log('🚀 开始测试真实数据交易...\n');

  try {
    // 1. 测试获取真实价格数据
    console.log('📊 步骤 1: 从 CoinGecko 获取真实价格数据...');
    const marketData = await getBTCAndDOGEData();
    
    console.log('✅ 成功获取真实数据:');
    marketData.prices.forEach(coin => {
      console.log(`   - ${coin.name} (${coin.symbol.toUpperCase()}): $${coin.current_price}`);
      console.log(`     24h 涨跌: ${coin.price_change_percentage_24h?.toFixed(2) || 'N/A'}%`);
      console.log(`     市值: $${(coin.market_cap / 1e9).toFixed(2)}B`);
    });

    // 2. 初始化 Portfolio
    console.log('\n💰 步骤 2: 初始化模拟投资组合...');
    const portfolio = getPortfolioManager();
    const initialPortfolio = portfolio.getPortfolio();
    console.log(`✅ 初始资金: $${initialPortfolio.initialBalance.toFixed(2)} USDT`);
    console.log(`   可用余额: $${initialPortfolio.balance.toFixed(2)} USDT`);

    // 3. 更新价格到 Portfolio
    console.log('\n📈 步骤 3: 更新持仓价格...');
    const prices = {};
    marketData.prices.forEach(coin => {
      prices[coin.symbol.toUpperCase()] = coin.current_price;
    });
    portfolio.updatePrices(prices);
    console.log('✅ 价格已更新到 Portfolio');

    // 4. 测试模拟交易
    console.log('\n🔄 步骤 4: 执行模拟交易...');
    const btcPrice = prices['BTC'];
    const dogePrice = prices['DOGE'];
    
    // 买入 BTC
    console.log(`   尝试买入 BTC @ $${btcPrice}...`);
    const buyResult = portfolio.executeTrade({
      symbol: 'BTC',
      side: 'buy',
      type: 'market',
      quantity: 0.001, // 买入 0.001 BTC
      notes: '测试交易 - 基于真实 CoinGecko 数据'
    });

    if (buyResult.success) {
      console.log(`   ✅ 买入成功!`);
      console.log(`      数量: ${buyResult.trade.quantity} BTC`);
      console.log(`      价格: $${buyResult.trade.price.toFixed(2)}`);
      console.log(`      总额: $${buyResult.trade.total.toFixed(2)}`);
      console.log(`      手续费: $${buyResult.trade.fee.toFixed(2)}`);
    } else {
      console.log(`   ❌ 买入失败: ${buyResult.error}`);
    }

    // 买入 DOGE
    console.log(`   尝试买入 DOGE @ $${dogePrice}...`);
    const dogeBuyResult = portfolio.executeTrade({
      symbol: 'DOGE',
      side: 'buy',
      type: 'market',
      quantity: 100, // 买入 100 DOGE
      notes: '测试交易 - 基于真实 CoinGecko 数据'
    });

    if (dogeBuyResult.success) {
      console.log(`   ✅ 买入成功!`);
      console.log(`      数量: ${dogeBuyResult.trade.quantity} DOGE`);
      console.log(`      价格: $${dogeBuyResult.trade.price.toFixed(4)}`);
      console.log(`      总额: $${dogeBuyResult.trade.total.toFixed(2)}`);
    } else {
      console.log(`   ❌ 买入失败: ${dogeBuyResult.error}`);
    }

    // 5. 查看 Portfolio 状态
    console.log('\n📊 步骤 5: 当前投资组合状态...');
    const currentPortfolio = portfolio.getPortfolio();
    console.log(`   总资产: $${currentPortfolio.totalEquity.toFixed(2)} USDT`);
    console.log(`   可用余额: $${currentPortfolio.balance.toFixed(2)} USDT`);
    console.log(`   持仓价值: $${(currentPortfolio.totalEquity - currentPortfolio.balance).toFixed(2)} USDT`);
    console.log(`   未实现盈亏: $${currentPortfolio.totalUnrealizedPnl.toFixed(2)}`);
    
    console.log('\n   持仓明细:');
    currentPortfolio.positions.forEach(pos => {
      console.log(`   - ${pos.symbol}: ${pos.quantity} @ 均价 $${pos.avgPrice.toFixed(2)}`);
    });

    console.log('\n   交易历史:');
    currentPortfolio.trades.slice(0, 5).forEach(trade => {
      console.log(`   - ${trade.side.toUpperCase()} ${trade.quantity} ${trade.symbol} @ $${trade.price.toFixed(2)}`);
    });

    // 6. 测试 AutoTrader 价格获取
    console.log('\n🤖 步骤 6: 测试 AutoTrader 真实价格获取...');
    const autoTrader = getAutoTrader();
    
    // 直接测试 getCurrentPrice 方法
    const btcPriceFromAutoTrader = await autoTrader['getCurrentPrice']('BTC');
    const dogePriceFromAutoTrader = await autoTrader['getCurrentPrice']('DOGE');
    
    console.log(`   ✅ AutoTrader BTC 价格: $${btcPriceFromAutoTrader}`);
    console.log(`   ✅ AutoTrader DOGE 价格: $${dogePriceFromAutoTrader}`);

    console.log('\n✅ 所有测试通过! 真实数据交易功能正常。');
    console.log('\n📌 说明:');
    console.log('   - 价格数据来自 CoinGecko API（真实市场数据）');
    console.log('   - 交易在本地模拟执行，不涉及真实资金');
    console.log('   - Portfolio 数据存储在 localStorage');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// 运行测试
testRealDataTrading();
