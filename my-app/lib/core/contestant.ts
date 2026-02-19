import { IClock } from './clock';
import { VirtualPortfolio, PortfolioSnapshot } from '../trading/portfolio';

/**
 * 参赛者接口
 */
export interface Contestant {
    id: string;
    name: string;

    /**
     * 初始化参赛者
     * @param initialCapital 初始资金
     * @param clock 注入的时钟（实盘或回测）
     */
    initialize(initialCapital: number, clock: IClock): Promise<void>;

    /**
     * 市场时间滴答（每分钟/每K线调用一次）
     * 参赛者在此决定是否进行分析或交易。
     */
    onTick(): Promise<void>;

    /**
     * 获取持仓与资产信息
     */
    getPortfolio(): VirtualPortfolio;

    /**
     * 获取最近一次产生的日志
     */
    getLogs?(): any[];

    /**
     * 获取资产管理器的全部交易记录（支持增量）
     */
    getTrades?(startIndex?: number): any[];

    /**
     * 获取表现指标
     */
    getMetrics(): any;
}
