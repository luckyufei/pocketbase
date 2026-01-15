import { BaseService } from "@/services/BaseService";

/**
 * 事件数据接口
 */
export interface AnalyticsEvent {
    event: string;
    path?: string;
    referrer?: string;
    title?: string;
    props?: Record<string, any>;
    timestamp?: number;
}

/**
 * 用户属性接口
 */
export interface UserProps {
    userId?: string;
    [key: string]: any;
}

/**
 * Analytics 配置接口
 */
export interface AnalyticsConfig {
    /** 是否自动采集 page_view 事件 */
    autoPageView?: boolean;
    /** 批量发送间隔（毫秒） */
    flushInterval?: number;
    /** 批量发送阈值（事件数量） */
    flushThreshold?: number;
    /** 是否启用调试模式 */
    debug?: boolean;
}

const STORAGE_KEY_OPT_OUT = "pb_analytics_opt_out";
const STORAGE_KEY_VISITOR_ID = "pb_analytics_visitor_id";

/**
 * AnalyticsService 提供用户行为分析功能。
 *
 * 使用示例：
 * ```js
 * const pb = new PocketBase("http://127.0.0.1:8090");
 *
 * // 初始化 Analytics（自动采集 page_view）
 * pb.analytics.init();
 *
 * // 手动埋点
 * pb.analytics.track("click_buy", { price: 99, productId: "123" });
 *
 * // 关联登录用户
 * pb.analytics.identify({ userId: "user123", plan: "pro" });
 *
 * // GDPR 合规：用户选择退出
 * pb.analytics.optOut();
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
    private visitorId: string = "";
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

        // 获取或生成 visitor ID
        this.visitorId = this.getOrCreateVisitorId();

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
        this.log("Analytics initialized");
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
     */
    trackPageView(): void {
        this.track("page_view", {
            url: typeof window !== "undefined" ? window.location.href : "",
        });
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

        const payload = {
            events,
            visitorId: this.visitorId,
            userProps: this.userProps,
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

    /**
     * 获取或创建 visitor ID。
     */
    private getOrCreateVisitorId(): string {
        if (typeof localStorage === "undefined") {
            return this.generateVisitorId();
        }

        let visitorId = localStorage.getItem(STORAGE_KEY_VISITOR_ID);
        if (!visitorId) {
            visitorId = this.generateVisitorId();
            localStorage.setItem(STORAGE_KEY_VISITOR_ID, visitorId);
        }
        return visitorId;
    }

    /**
     * 生成唯一的 visitor ID。
     */
    private generateVisitorId(): string {
        // 使用时间戳 + 随机数生成唯一 ID
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
            const response = await this.client.send("/api/analytics/config", {
                method: "GET",
            });
            this.isEnabled = response?.enabled === true;
            this.log("Analytics enabled on server:", this.isEnabled);
            return this.isEnabled;
        } catch (error) {
            // 如果请求失败（如 401 未授权或 404 未启用），假设未启用
            this.log("Failed to check analytics config:", error);
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
}
