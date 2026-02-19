/**
 * TradeMind Framework - Clock System
 * 
 * 提供统一的时间获取接口，支持在实盘（SystemTime）和回测（VirtualTime）之间切换。
 */

export interface IClock {
    /**
     * 获取当前 Unix 时间戳 (ms)
     */
    now(): number;

    /**
     * 获取当前时间的 Date 对象
     */
    date(): Date;
}

/**
 * 系统时钟 - 用于实盘运行，直接调用系统时间
 */
export class SystemClock implements IClock {
    now(): number {
        return Date.now();
    }

    date(): Date {
        return new Date();
    }
}

/**
 * 虚拟时钟 - 用于回测运行，由 RaceController 手动推进时间
 */
export class VirtualClock implements IClock {
    private currentTimestamp: number;

    constructor(initialTimestamp: number) {
        this.currentTimestamp = initialTimestamp;
    }

    /**
     * 推进虚拟时间
     * @param ms 增加的毫秒数
     */
    advance(ms: number): void {
        this.currentTimestamp += ms;
    }

    /**
     * 设置特定的虚拟时间
     */
    setCurrentTime(timestamp: number): void {
        this.currentTimestamp = timestamp;
    }

    now(): number {
        return this.currentTimestamp;
    }

    date(): Date {
        return new Date(this.currentTimestamp);
    }
}

// 默认导出单例系统时钟，方便普通场景使用
export const systemClock = new SystemClock();
