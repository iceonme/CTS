"use client";

import { useState, useRef, useEffect } from 'react';
import EquityChart from '../components/backtest/EquityChart';
import { DEFAULT_LLM_SYSTEM_PROMPT } from '@/lib/agents/contestants/llm-solo-contestant';

const CONTESTANTS_METADATA = [
    { id: 'dca-bot', name: '基准定投 (DCA)', color: '#3b82f6' }, // Blue
    { id: 'mas-squad', name: 'MAS 协作小队', color: '#10b981' }, // Emerald
    { id: 'llm-solo', name: 'LLM 单兵 (MiniMax)', color: '#a855f7' }, // Purple
];

export default function ArenaPage() {
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [trades, setTrades] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'logs' | 'trades'>('logs');
    const [allContestants, setAllContestants] = useState<any[]>(CONTESTANTS_METADATA.map(c => ({
        ...c,
        type: c.id === 'dca-bot' ? 'dca' : c.id === 'mas-squad' ? 'mas' : 'llm-solo',
        settings: c.id === 'llm-solo' ? { systemPrompt: DEFAULT_LLM_SYSTEM_PROMPT } : c.id === 'dca-bot' ? { investAmount: 500, intervalMinutes: 10080 } : {}
    })));
    const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'stopped'>('idle');
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [results, setResults] = useState<any[]>([]);
    const statusRef = useRef(status);

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    const [config, setConfig] = useState({
        symbol: 'BTCUSDT',
        start: '2025-01-01',
        end: '2025-01-07',
        stepMinutes: 15,
    });
    const [selectedContestants, setSelectedContestants] = useState<string[]>(['dca-bot', 'llm-solo']);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);

    const handleContestantToggle = (contestantId: string) => {
        setSelectedContestants(prev =>
            prev.includes(contestantId)
                ? prev.filter(id => id !== contestantId)
                : [...prev, contestantId]
        );
    };

    const terminateBacktest = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
            setStatus('stopped');
        }
    };

    const runBacktest = async () => {
        if (selectedContestants.length === 0) {
            alert('请至少选择一名参赛选手');
            return;
        }

        const controller = new AbortController();
        setAbortController(controller);
        setStatus('running');

        setLoading(true);
        setHistory([]);
        setLogs([]);
        setResults([]);

        try {
            const contestantPayload = allContestants
                .filter(c => selectedContestants.includes(c.id))
                .map(c => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    settings: c.settings
                }));

            const response = await fetch('/api/backtest/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...config, contestants: contestantPayload }),
                signal: controller.signal
            });

            if (!response.body) throw new Error('Response body is null');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                // 实现暂停逻辑: 如果状态为 paused，则循环等待直到变运行或终止
                while (statusRef.current === 'paused') {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                const { done, value } = await reader.read();
                if (done) break;

                // 如果已经终止，直接退出
                if (statusRef.current === 'stopped') break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const payload = JSON.parse(line);
                        if (payload.type === 'progress') {
                            // 1. 处理历史图表数据 (仅当包含 equities 时)
                            if (payload.data.equities) {
                                setHistory(prev => [...prev, {
                                    timestamp: payload.data.timestamp,
                                    equities: payload.data.equities,
                                    progress: payload.data.progress
                                }]);
                            }

                            // 2. 处理日志 (独立处理)
                            if (payload.data.logs) {
                                Object.entries(payload.data.logs).forEach(([contestantId, contestantLogs]: [string, any]) => {
                                    if (Array.isArray(contestantLogs) && contestantLogs.length > 0) {
                                        const metadata = allContestants.find(c => c.id === contestantId);
                                        setLogs(prev => [
                                            ...prev,
                                            ...contestantLogs.map(log => ({
                                                ...log,
                                                contestantName: metadata?.name || contestantId,
                                                contestantColor: metadata?.color || '#ccc'
                                            }))
                                        ]);
                                    }
                                });
                            }

                            // 3. 处理交易记录 (独立处理)
                            if (payload.data.trades) {
                                Object.entries(payload.data.trades).forEach(([contestantId, contestantTrades]: [string, any]) => {
                                    if (Array.isArray(contestantTrades) && contestantTrades.length > 0) {
                                        const metadata = allContestants.find(c => c.id === contestantId);
                                        setTrades(prev => [
                                            ...contestantTrades.map(trade => ({
                                                ...trade,
                                                contestantName: metadata?.name || contestantId,
                                                contestantColor: metadata?.color || '#ccc'
                                            })),
                                            ...prev // 新交易放前面
                                        ]);
                                    }
                                });
                            }
                        } else if (payload.type === 'final') {
                            setResults(payload.data.results);
                            setStatus('idle');
                        } else if (payload.type === 'error') {
                            if (payload.data.message !== 'BACKTEST_ABORTED') {
                                alert('回测错误: ' + payload.data.message);
                            }
                            setStatus('idle');
                        }
                    } catch (e) {
                        console.error('Failed to parse line:', line);
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error(err);
                alert('回测连接中断或发生异常');
            }
        } finally {
            setLoading(false);
            if (statusRef.current === 'running') {
                setStatus('idle');
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            {/* 头部 */}
            <header className="bg-gray-900 border-b border-gray-800 p-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🏟️</span>
                        <div>
                            <h1 className="text-xl font-bold text-white">回测竞技场 (Arena)</h1>
                            <p className="text-sm text-gray-400">对比不同策略在历史行情下的表现</p>
                        </div>
                    </div>
                    <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">← 返回首页</a>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* 左侧配置栏 */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">回测配置</h3>

                        <div className="space-y-2">
                            <label className="text-xs text-gray-500">交易对</label>
                            <select
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                value={config.symbol}
                                onChange={(e) => setConfig({ ...config, symbol: e.target.value })}
                            >
                                <option value="BTCUSDT">BTC/USDT</option>
                                <option value="ETHUSDT">ETH/USDT</option>
                                <option value="SOLUSDT">SOL/USDT</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-xs text-gray-500">开始日期</label>
                                <input
                                    type="date"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                                    value={config.start}
                                    onChange={(e) => setConfig({ ...config, start: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-gray-500">结束日期</label>
                                <input
                                    type="date"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                                    value={config.end}
                                    onChange={(e) => setConfig({ ...config, end: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-gray-500">步长 (分钟)</label>
                            <input
                                type="number"
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                value={config.stepMinutes}
                                onChange={(e) => setConfig({ ...config, stepMinutes: parseInt(e.target.value) })}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            {status === 'idle' || status === 'stopped' ? (
                                <button
                                    onClick={runBacktest}
                                    disabled={loading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                                >
                                    🚀 启动竞技
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setStatus(status === 'paused' ? 'running' : 'paused')}
                                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                    >
                                        {status === 'paused' ? '▶️ 继续' : '⏸ 暂停'}
                                    </button>
                                    <button
                                        onClick={terminateBacktest}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                    >
                                        ⏹ 终止
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 参赛选手卡片 */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">参赛选手</h3>
                            <button
                                onClick={() => setIsAdding(true)}
                                className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-2 py-1 rounded transition-colors"
                            >
                                ＋ 新建
                            </button>
                        </div>
                        <div className="space-y-3">
                            {allContestants.map(c => (
                                <div
                                    key={c.id}
                                    className={`group flex items-center justify-between p-3 rounded-lg border transition-all ${selectedContestants.includes(c.id)
                                        ? 'bg-blue-900/10 border-blue-500/50'
                                        : 'bg-gray-800/50 border-gray-800 hover:border-gray-700'
                                        }`}
                                >
                                    <div
                                        className="flex items-center gap-3 cursor-pointer flex-1"
                                        onClick={() => handleContestantToggle(c.id)}
                                    >
                                        <div className="w-4 h-4 rounded border border-gray-600 flex items-center justify-center">
                                            {selectedContestants.includes(c.id) && <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></div>}
                                        </div>
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }}></div>
                                        <div className="flex flex-col">
                                            <span className={`text-sm ${selectedContestants.includes(c.id) ? 'text-blue-100' : 'text-gray-400'}`}>
                                                {c.name}
                                            </span>
                                            <span className="text-[10px] text-gray-600 uppercase">{c.type}</span>
                                        </div>
                                    </div>

                                    {c.type !== 'mas' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setEditingId(c.id); }}
                                            className="opacity-0 group-hover:opacity-100 text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-400 px-2 py-1 rounded transition-all"
                                        >
                                            ⚙️ 配置
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 右侧图表与结果区 */}
                <div className="lg:col-span-3 space-y-6">
                    {/* 图表卡片 */}
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 relative min-h-[500px] flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                📈 净值收益曲线
                                {loading && <span className="text-xs font-normal text-blue-400 animate-pulse">(实时模拟中...)</span>}
                            </h2>
                            <div className="flex gap-4">
                                {results.map(res => (
                                    <div key={res.contestantId} className="text-right">
                                        <div className="text-[10px] text-gray-500 uppercase">{res.name}</div>
                                        <div className={`text-sm font-bold ${res.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {(res.totalReturn * 100).toFixed(2)}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 w-full relative">
                            {history.length > 0 ? (
                                <EquityChart
                                    data={history}
                                    contestants={allContestants.filter(c => selectedContestants.includes(c.id))}
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                                    <div className="text-center">
                                        <div className="text-4xl mb-4">📊</div>
                                        <p>准备就绪。点击“启动竞技”观察策略表现。</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* 实时数据面板 (Log & Trades) */}
                    {(logs.length > 0 || trades.length > 0 || loading) && (
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col h-[450px]">
                            {/* Tab 选择器 */}
                            <div className="flex border-b border-gray-800 bg-gray-800/20">
                                <button
                                    onClick={() => setActiveTab('logs')}
                                    className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${activeTab === 'logs' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    📜 实时日志
                                    {loading && activeTab === 'logs' && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>}
                                </button>
                                <button
                                    onClick={() => setActiveTab('trades')}
                                    className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${activeTab === 'trades' ? 'bg-gray-800 text-emerald-400 border-b-2 border-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    🤝 交易历史
                                    {trades.length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 text-[10px]">{trades.length}</span>}
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-0">
                                {activeTab === 'logs' ? (
                                    <div className="p-4 space-y-3 font-mono text-xs">
                                        {logs.length === 0 ? (
                                            <div className="text-gray-600 text-center py-10 italic">等待选手做出决策...</div>
                                        ) : (
                                            logs.slice(-200).map((log, i) => (
                                                <div key={i} className="border-l-2 pl-3 py-1 bg-gray-800/10 rounded-r" style={{ borderColor: log.contestantColor }}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                                        <span className="font-bold" style={{ color: log.contestantColor }}>{log.contestantName}</span>
                                                        {log.type === 'decision' && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${log.decision === 'BUY' ? 'bg-green-900/30 text-green-400' :
                                                                log.decision === 'SELL' ? 'bg-red-900/30 text-red-400' :
                                                                    'bg-gray-700 text-gray-400'
                                                                }`}>
                                                                {log.decision} {log.percentage > 0 && `${(log.percentage * 100).toFixed(0)}%`}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-gray-300 leading-relaxed">
                                                        {log.type === 'decision' ? log.reasoning : log.message}
                                                    </p>
                                                </div>
                                            )).reverse()
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-xs">
                                        {trades.length === 0 ? (
                                            <div className="text-gray-600 text-center py-10 italic">暂无成交记录</div>
                                        ) : (
                                            <table className="w-full text-left">
                                                <thead className="sticky top-0 bg-gray-900 border-b border-gray-800 text-[10px] text-gray-500 uppercase">
                                                    <tr>
                                                        <th className="px-4 py-2">时间</th>
                                                        <th className="px-4 py-2">选手</th>
                                                        <th className="px-4 py-2">方向</th>
                                                        <th className="px-4 py-2">价格</th>
                                                        <th className="px-4 py-2">数量</th>
                                                        <th className="px-4 py-2">明细</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-800/50">
                                                    {trades.slice(0, 200).map((trade, i) => (
                                                        <tr key={i} className="hover:bg-gray-800/20 transition-colors">
                                                            <td className="px-4 py-3 text-gray-500">{new Date(trade.timestamp).toLocaleTimeString()}</td>
                                                            <td className="px-4 py-3 font-medium" style={{ color: trade.contestantColor }}>{trade.contestantName}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`font-bold ${trade.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {trade.side === 'BUY' ? '买入' : '卖出'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-300">${trade.price.toLocaleString()}</td>
                                                            <td className="px-4 py-3 text-gray-300">{trade.quantity.toFixed(4)}</td>
                                                            <td className="px-4 py-3">
                                                                <span className="text-gray-500 truncate block max-w-[150px]" title={trade.reason}>
                                                                    {trade.reason || '--'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 详细指标表格 */}
                    {results.length > 0 && (
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                            <div className="p-4 border-b border-gray-800 bg-gray-800/20">
                                <h3 className="text-sm font-bold">最终战报</h3>
                            </div>
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-800/10">
                                    <tr>
                                        <th className="px-6 py-4">选手</th>
                                        <th className="px-6 py-4">最终净值</th>
                                        <th className="px-6 py-4">累计回报</th>
                                        <th className="px-6 py-4">交易次数</th>
                                        <th className="px-6 py-4">夏普比率</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {results.map(res => (
                                        <tr key={res.contestantId} className="hover:bg-gray-800/30 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">{res.name}</td>
                                            <td className="px-6 py-4">${res.finalEquity.toFixed(2)}</td>
                                            <td className={`px-6 py-4 font-bold ${res.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {(res.totalReturn * 100).toFixed(2)}%
                                            </td>
                                            <td className="px-6 py-4">{res.tradeCount}</td>
                                            <td className="px-6 py-4 text-gray-400">--</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* 配置弹窗 */}
            {editingId && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/40">
                            <h3 className="font-bold flex items-center gap-2">
                                ⚙️ 配置选手: {allContestants.find(c => c.id === editingId)?.name}
                            </h3>
                            <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-white">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            {allContestants.find(c => c.id === editingId)?.type === 'dca' ? (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-xs text-gray-500 uppercase">定投金额 (USDT)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
                                            value={allContestants.find(c => c.id === editingId)?.settings.investAmount}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                setAllContestants(prev => prev.map(c => c.id === editingId ? { ...c, settings: { ...c.settings, investAmount: val } } : c));
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs text-gray-500 uppercase">时间间隔 (分钟)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
                                            value={allContestants.find(c => c.id === editingId)?.settings.intervalMinutes}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                setAllContestants(prev => prev.map(c => c.id === editingId ? { ...c, settings: { ...c.settings, intervalMinutes: val } } : c));
                                            }}
                                        />
                                        <p className="text-[10px] text-gray-500 italic">提示: 10080 分钟 = 1 周, 1440 分钟 = 1 天</p>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-500 uppercase">系统提示词 (System Prompt)</label>
                                    <textarea
                                        className="w-full h-64 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 resize-none font-sans"
                                        placeholder="输入自定义的交易策略描述..."
                                        value={allContestants.find(c => c.id === editingId)?.settings.systemPrompt}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setAllContestants(prev => prev.map(c => c.id === editingId ? { ...c, settings: { ...c.settings, systemPrompt: val } } : c));
                                        }}
                                    />
                                </div>
                            )}
                            <button
                                onClick={() => setEditingId(null)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
                            >
                                保存并关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 新建选手弹窗 */}
            {isAdding && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-gray-800 bg-gray-800/40">
                            <h3 className="font-bold">✨ 创建新选手</h3>
                        </div>
                        <form className="p-6 space-y-4" onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const name = formData.get('name') as string;
                            const type = formData.get('type') as string;
                            const newId = `custom-${Date.now()}`;
                            const colors = ['#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];
                            const newContestant = {
                                id: newId,
                                name,
                                type,
                                color: colors[allContestants.length % colors.length],
                                settings: type === 'llm-solo' ? { systemPrompt: DEFAULT_LLM_SYSTEM_PROMPT } : { investAmount: 500, intervalMinutes: 10080 }
                            };
                            setAllContestants([...allContestants, newContestant]);
                            setSelectedContestants([...selectedContestants, newId]);
                            setIsAdding(false);
                            setEditingId(newId);
                        }}>
                            <div className="space-y-2">
                                <label className="text-xs text-gray-500">选手名称</label>
                                <input name="name" required className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none" placeholder="例如: 极致抄底王" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-gray-500">策略类型</label>
                                <select name="type" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none">
                                    <option value="dca">定投 (DCA)</option>
                                    <option value="llm-solo">LLM 单兵</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsAdding(false)} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm transition-colors">取消</button>
                                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold transition-colors">创建</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
