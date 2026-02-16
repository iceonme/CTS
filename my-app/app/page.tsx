import ChatInterface from "./components/ChatInterface";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* 顶部导航 */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📈</span>
              <div>
                <h1 className="text-xl font-bold text-white">CryptoPulse AI</h1>
                <p className="text-xs text-gray-400">CTS - Crypto Trading Squad</p>
              </div>
            </div>
            <nav className="flex gap-4">
              <a href="/" className="text-sm font-medium text-blue-400">首页</a>
              <a href="/feed" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                情报流
              </a>
              <a href="/warroom" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                WarRoom
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
          {/* 左侧边栏 - 快速信息 */}
          <div className="hidden lg:block lg:col-span-1 space-y-4">
            {/* 市场概览卡片 */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h3 className="text-sm font-medium text-gray-400 mb-3">📊 市场概览</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">BTC</span>
                  <span className="text-sm text-green-400">+2.3%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">DOGE</span>
                  <span className="text-sm text-red-400">-1.2%</span>
                </div>
              </div>
            </div>

            {/* CFO 状态 */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h3 className="text-sm font-medium text-gray-400 mb-3">🤖 CFO 状态</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">状态</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    在线
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">盯盘频率</span>
                  <span className="text-gray-400">15分钟</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">监控标的</span>
                  <span className="text-gray-400">BTC, DOGE</span>
                </div>
              </div>
            </div>

            {/* 快捷导航 */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h3 className="text-sm font-medium text-gray-400 mb-3">⚡ 快捷导航</h3>
              <div className="space-y-2">
                <a
                  href="/feed"
                  className="block px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
                >
                  📜 查看情报流
                </a>
                <a
                  href="/warroom"
                  className="block px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
                >
                  ⚔️ 进入 WarRoom
                </a>
              </div>
            </div>
          </div>

          {/* 右侧 - CFO 对话界面 */}
          <div className="lg:col-span-3 h-full">
            <ChatInterface />
          </div>
        </div>
      </main>
    </div>
  );
}
