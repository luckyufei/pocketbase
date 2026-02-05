import { BaseService } from "@/services/BaseService";

/**
 * 事件数据接口（发送到服务端）
 */
export interface AnalyticsEvent {
    /** 事件类型（如 page_view, click, purchase） */
    event: string;
    /** 页面路径 */
    path?: string;
    /** 来源页面 */
    referrer?: string;
    /** 页面标题 */
    title?: string;
    /** 会话 ID（用于 UV 去重） */
    sessionId?: string;
    /** 页面加载耗时（毫秒） */
    perfMs?: number;
    /** 事件时间戳（毫秒） */
    timestamp?: number;
    /** 自定义属性 */
    props?: Record<string, any>;
}

/**
 * 用户属性接口
 */
export interface UserProps {
    userId?: string;
    [key: string]: any;
}

/**
 * Analytics SDK 配置接口
 */
export interface AnalyticsConfig {
    /** 是否自动采集 page_view 事件 */
    autoPageView?: boolean;
    /** 批量发送间隔（毫秒），默认 5000 */
    flushInterval?: number;
    /** 批量发送阈值（事件数量），默认 10 */
    flushThreshold?: number;
    /** 是否启用调试模式 */
    debug?: boolean;
    /** 自定义 sessionId（默认自动生成） */
    sessionId?: string;
}

/**
 * 服务端 Analytics 配置响应
 */
export interface ServerAnalyticsConfig {
    enabled: boolean;
    retention: number;
    flushInterval: number;
    hasS3: boolean;
}

/**
 * 统计数据响应
 */
export interface StatsResponse {
    summary: {
        totalPV: number;
        totalUV: number;
        bounceRate: number;
        avgDur: number;
    };
    daily: Array<{
        date: string;
        pv: number;
        uv: number;
    }>;
    startDate: string;
    endDate: string;
}

/**
 * Top Pages 响应
 */
export interface TopPagesResponse {
    pages: Array<{
        path: string;
        pv: number;
        visitors: number;
    }>;
    startDate: string;
    endDate: string;
}

/**
 * Top Sources 响应
 */
export interface TopSourcesResponse {
    sources: Array<{
        source: string;
        visitors: number;
    }>;
    startDate: string;
    endDate: string;
}

/**
 * Devices 响应
 */
export interface DevicesResponse {
    browsers: Array<{
        name: string;
        visitors: number;
    }>;
    os: Array<{
        name: string;
        visitors: number;
    }>;
    startDate: string;
    endDate: string;
}

/**
 * Raw Logs 响应
 */
export interface RawLogsResponse {
    dates: string[];
}

const STORAGE_KEY_OPT_OUT = "pb_analytics_opt_out";
const STORAGE_KEY_SESSION_ID = "pb_analytics_session_id";

/**
 * AnalyticsService 提供用户行为分析功能。
 *
 * 使用示例：
 * ```js
 * const pb = new PocketBase("http://127.0.0.1:8090");
 *
 * // 初始化 Analytics（自动采集 page_view）
 * await pb.analytics.init();
 *
 * // 手动埋点
 * pb.analytics.track("click_buy", { price: 99, productId: "123" });
 *
 * // 关联登录用户
 * pb.analytics.identify({ userId: "user123", plan: "pro" });
 *
 * // GDPR 合规：用户选择退出
 * pb.analytics.optOut();
 * 
 * // === 管理员 API（需要 Superuser 认证）===
 * // 获取统计数据
 * const stats = await pb.analytics.getStats("7d");
 * 
 * // 获取热门页面
 * const pages = await pb.analytics.getTopPages("7d", 10);
 * ```
 */
export class AnalyticsService extends BaseService {
    private eventQueue: AnalyticsEvent[] = [];
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private config: AnalyticsConfig = {
        autoPageView: true,
        flushInterval: 5000,
        flushThreshold: 10,
        debug: false,
    };
    private userProps: UserProps = {};
    private isInitialized = false;
    private sessionId: string = "";
    private isEnabled: boolean | null = null;

    /**
     * 初始化 Analytics 服务。
     *
     * @param config 可选配置
     */
    async init(config?: AnalyticsConfig): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        if (config) {
            this.config = { ...this.config, ...config };
        }

        // 检查是否已 opt-out
        if (this.isOptedOut()) {
            this.log("Analytics is opted out, skipping initialization");
            return;
        }

        // 检查后端是否启用 Analytics
        const enabled = await this.checkAnalyticsEnabled();
        if (!enabled) {
            this.log("Analytics is disabled on server, skipping initialization");
            return;
        }

        // 获取或生成 session ID
        this.sessionId = this.config.sessionId || this.getOrCreateSessionId();

        // 自动采集 page_view
        if (this.config.autoPageView && typeof window !== "undefined") {
            this.trackPageView();
            this.setupHistoryListener();
        }

        // 设置页面卸载时发送事件
        if (typeof window !== "undefined") {
            window.addEventListener("beforeunload", () => this.flush(true));
            window.addEventListener("pagehide", () => this.flush(true));
        }

        // 启动定时 flush
        this.startFlushTimer();

        this.isInitialized = true;
        this.log("Analytics initialized with sessionId:", this.sessionId);
    }

    /**
     * 跟踪自定义事件。
     *
     * @param event 事件名称
     * @param props 事件属性
     */
    track(event: string, props?: Record<string, any>): void {
        if (this.isOptedOut()) {
            return;
        }

        const analyticsEvent: AnalyticsEvent = {
            event,
            path: typeof window !== "undefined" ? window.location.pathname : "",
            referrer: typeof document !== "undefined" ? document.referrer : "",
            title: typeof document !== "undefined" ? document.title : "",
            sessionId: this.sessionId,
            props: props || {},
            timestamp: Date.now(),
        };

        this.eventQueue.push(analyticsEvent);
        this.log("Event tracked:", event, props);

        // 检查是否需要立即 flush
        if (this.eventQueue.length >= (this.config.flushThreshold || 10)) {
            this.flush();
        }
    }

    /**
     * 跟踪页面浏览事件。
     * @param perfMs 页面加载耗时（毫秒），可选
     */
    trackPageView(perfMs?: number): void {
        const props: Record<string, any> = {
            url: typeof window !== "undefined" ? window.location.href : "",
        };
        
        // 添加性能数据
        if (perfMs !== undefined) {
            props.perfMs = perfMs;
        } else if (typeof performance !== "undefined") {
            props.perfMs = Math.round(performance.now());
        }

        this.track("page_view", props);
    }

    /**
     * 关联用户属性。
     *
     * @param props 用户属性
     */
    identify(props: UserProps): void {
        if (this.isOptedOut()) {
            return;
        }

        this.userProps = { ...this.userProps, ...props };
        this.log("User identified:", props);

        // 发送 identify 事件
        this.track("identify", props);
    }

    /**
     * 用户选择退出分析（GDPR 合规）。
     */
    optOut(): void {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_KEY_OPT_OUT, "true");
        }
        this.eventQueue = [];
        this.stopFlushTimer();
        this.log("User opted out of analytics");
    }

    /**
     * 用户选择重新加入分析。
     */
    optIn(): void {
        if (typeof localStorage !== "undefined") {
            localStorage.removeItem(STORAGE_KEY_OPT_OUT);
        }
        this.init(this.config);
        this.log("User opted in to analytics");
    }

    /**
     * 检查用户是否已退出分析。
     */
    isOptedOut(): boolean {
        if (typeof localStorage === "undefined") {
            return false;
        }
        return localStorage.getItem(STORAGE_KEY_OPT_OUT) === "true";
    }

    /**
     * 立即发送所有缓存的事件。
     *
     * @param useBeacon 是否使用 Beacon API（页面卸载时使用）
     */
    async flush(useBeacon = false): Promise<void> {
        if (this.eventQueue.length === 0) {
            return;
        }

        const events = [...this.eventQueue];
        this.eventQueue = [];

        // 转换为服务端期望的格式
        const payload = {
            events: events.map(e => ({
                event: e.event,
                path: e.path,
                referrer: e.referrer,
                title: e.title,
                sessionId: e.sessionId || this.sessionId,
                perfMs: e.props?.perfMs,
                timestamp: e.timestamp,
                // 其他 props 展开
                ...e.props,
            })),
        };

        this.log("Flushing events:", events.length);

        try {
            if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
                // 使用 Beacon API（页面卸载时）
                const url = this.client.buildURL("/api/analytics/events");
                navigator.sendBeacon(url, JSON.stringify(payload));
            } else {
                // 使用 fetch
                await this.client.send("/api/analytics/events", {
                    method: "POST",
                    body: payload,
                });
            }
        } catch (error) {
            this.log("Failed to flush events:", error);
            // 失败时将事件放回队列
            this.eventQueue = [...events, ...this.eventQueue];
        }
    }

    // ==================== 管理员 API ====================

    /**
     * 获取统计数据概览。
     * 需要 Superuser 认证。
     *
     * @param range 日期范围（today, 7d, 30d, 90d）
     */
    async getStats(range: string = "7d"): Promise<StatsResponse> {
        return this.client.send("/api/analytics/stats", {
            method: "GET",
            query: { range },
        });
    }

    /**
     * 获取热门页面排行。
     * 需要 Superuser 认证。
     *
     * @param range 日期范围
     * @param limit 返回条数（默认 10，最大 100）
     */
    async getTopPages(range: string = "7d", limit: number = 10): Promise<TopPagesResponse> {
        return this.client.send("/api/analytics/top-pages", {
            method: "GET",
            query: { range, limit },
        });
    }

    /**
     * 获取流量来源排行。
     * 需要 Superuser 认证。
     *
     * @param range 日期范围
     * @param limit 返回条数（默认 10，最大 100）
     */
    async getTopSources(range: string = "7d", limit: number = 10): Promise<TopSourcesResponse> {
        return this.client.send("/api/analytics/top-sources", {
            method: "GET",
            query: { range, limit },
        });
    }

    /**
     * 获取设备/浏览器统计。
     * 需要 Superuser 认证。
     *
     * @param range 日期范围
     */
    async getDevices(range: string = "7d"): Promise<DevicesResponse> {
        return this.client.send("/api/analytics/devices", {
            method: "GET",
            query: { range },
        });
    }

    /**
     * 获取可下载的原始日志日期列表。
     * 需要 Superuser 认证。
     */
    async getRawLogs(): Promise<RawLogsResponse> {
        return this.client.send("/api/analytics/raw-logs", {
            method: "GET",
        });
    }

    /**
     * 获取原始日志下载 URL。
     *
     * @param date 日期（格式：YYYY-MM-DD）
     */
    getRawLogDownloadURL(date: string): string {
        return this.client.buildURL(`/api/analytics/raw-logs/${date}`);
    }

    /**
     * 获取服务端 Analytics 配置。
     * 需要 Superuser 认证。
     */
    async getServerConfig(): Promise<ServerAnalyticsConfig> {
        return this.client.send("/api/analytics/config", {
            method: "GET",
        });
    }

    // ==================== 私有方法 ====================

    /**
     * 获取或创建 session ID。
     */
    private getOrCreateSessionId(): string {
        if (typeof localStorage === "undefined") {
            return this.generateSessionId();
        }

        let sessionId = localStorage.getItem(STORAGE_KEY_SESSION_ID);
        if (!sessionId) {
            sessionId = this.generateSessionId();
            localStorage.setItem(STORAGE_KEY_SESSION_ID, sessionId);
        }
        return sessionId;
    }

    /**
     * 生成唯一的 session ID。
     */
    private generateSessionId(): string {
        // 优先使用 crypto.randomUUID
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // 降级方案：时间戳 + 随机数
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 15);
        return `${timestamp}-${random}`;
    }

    /**
     * 设置 History API 监听器（SPA 路由变化）。
     */
    private setupHistoryListener(): void {
        if (typeof window === "undefined") {
            return;
        }

        // 监听 popstate 事件（浏览器前进/后退）
        window.addEventListener("popstate", () => {
            this.trackPageView();
        });

        // 拦截 pushState 和 replaceState
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = (...args) => {
            originalPushState.apply(history, args);
            this.trackPageView();
        };

        history.replaceState = (...args) => {
            originalReplaceState.apply(history, args);
            this.trackPageView();
        };
    }

    /**
     * 启动定时 flush。
     */
    private startFlushTimer(): void {
        if (this.flushTimer) {
            return;
        }

        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.config.flushInterval || 5000);
    }

    /**
     * 停止定时 flush。
     */
    private stopFlushTimer(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
    }

    /**
     * 调试日志。
     */
    private log(...args: any[]): void {
        if (this.config.debug) {
            console.log("[PocketBase Analytics]", ...args);
        }
    }

    /**
     * 检查后端是否启用 Analytics。
     * 缓存结果以避免重复请求。
     */
    private async checkAnalyticsEnabled(): Promise<boolean> {
        // 如果已经检查过，返回缓存结果
        if (this.isEnabled !== null) {
            return this.isEnabled;
        }

        try {
            // 尝试调用 config 接口检查是否启用
            // 注意：config 接口需要 Superuser 认证，所以我们用另一种方式
            // 直接尝试发送一个空事件，如果返回 404 说明未启用
            await this.client.send("/api/analytics/events", {
                method: "POST",
                body: { events: [] },
            });
            // 如果没有抛出错误，说明 Analytics 是启用的（即使返回错误 "No events provided"）
            this.isEnabled = true;
            this.log("Analytics enabled on server");
            return true;
        } catch (error: any) {
            // 如果是 404，说明 Analytics 未启用
            if (error?.status === 404) {
                this.isEnabled = false;
                this.log("Analytics is disabled on server");
                return false;
            }
            // 如果是 400（No events provided），说明 Analytics 是启用的
            if (error?.status === 400) {
                this.isEnabled = true;
                this.log("Analytics enabled on server");
                return true;
            }
            // 其他错误，假设未启用
            this.log("Failed to check analytics status:", error);
            this.isEnabled = false;
            return false;
        }
    }

    /**
     * 获取 Analytics 是否在服务端启用。
     * 如果尚未检查，返回 null。
     */
    get serverEnabled(): boolean | null {
        return this.isEnabled;
    }

    /**
     * 获取当前 session ID。
     */
    get currentSessionId(): string {
        return this.sessionId;
    }
}
