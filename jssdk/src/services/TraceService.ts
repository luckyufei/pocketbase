import { ClientResponseError } from "@/ClientResponseError";
import { BaseService } from "@/services/BaseService";
import { ListResult } from "@/tools/dtos";
import { CommonOptions } from "@/tools/options";

/**
 * Span 类型
 */
export type SpanKind = "INTERNAL" | "SERVER" | "CLIENT" | "PRODUCER" | "CONSUMER";

/**
 * Span 状态
 */
export type SpanStatus = "UNSET" | "OK" | "ERROR";

/**
 * Span 模型
 */
export interface SpanModel {
    trace_id: string;
    span_id: string;
    parent_id: string;
    name: string;
    kind: SpanKind;
    start_time: number;
    duration: number;
    status: SpanStatus;
    attributes: { [key: string]: any };
    created: string;
}

/**
 * Trace 统计数据
 */
export interface TraceStats {
    total_requests: number;
    success_count: number;
    error_count: number;
    p50_latency: number;
    p95_latency: number;
    p99_latency: number;
}

/**
 * Trace 查询选项
 */
export interface TraceListOptions extends CommonOptions {
    /**
     * 按 trace_id 过滤
     */
    trace_id?: string;

    /**
     * 按 span_id 过滤
     */
    span_id?: string;

    /**
     * 按操作名称过滤
     */
    operation?: string;

    /**
     * 按状态过滤（OK 或 ERROR）
     */
    status?: "OK" | "ERROR";

    /**
     * 开始时间（Unix 微秒）
     */
    start_time?: number;

    /**
     * 结束时间（Unix 微秒）
     */
    end_time?: number;

    /**
     * 只返回根 Span
     */
    root_only?: boolean;

    /**
     * 返回数量限制
     */
    limit?: number;

    /**
     * 偏移量
     */
    offset?: number;

    /**
     * 按 attributes 字段过滤
     * 例如: { "http.method": "GET", "http.status_code": "200" }
     */
    attributes?: { [key: string]: string };
}

/**
 * Trace 统计选项
 */
export interface TraceStatsOptions extends CommonOptions {
    /**
     * 开始时间（Unix 微秒）
     */
    start_time?: number;

    /**
     * 结束时间（Unix 微秒）
     */
    end_time?: number;
}

/**
 * Trace 详情结果
 */
export interface TraceDetail {
    trace_id: string;
    spans: SpanModel[];
}

export class TraceService extends BaseService {
    /**
     * 返回分页的 Span 列表
     *
     * @throws {ClientResponseError}
     */
    async getList(
        page = 1,
        perPage = 30,
        options?: TraceListOptions,
    ): Promise<ListResult<SpanModel>> {
        // 复制 options 并移除自定义字段
        const sendOptions: { [key: string]: any } = Object.assign(
            { method: "GET" },
            options,
        );

        // 删除自定义参数，避免被序列化到 query 中
        delete sendOptions.trace_id;
        delete sendOptions.span_id;
        delete sendOptions.operation;
        delete sendOptions.status;
        delete sendOptions.start_time;
        delete sendOptions.end_time;
        delete sendOptions.root_only;
        delete sendOptions.limit;
        delete sendOptions.offset;
        delete sendOptions.attributes;

        // 构建查询参数
        const queryParams: { [key: string]: any } = {
            limit: perPage,
            offset: (page - 1) * perPage,
        };

        if (options?.trace_id) {
            queryParams.trace_id = options.trace_id;
        }
        if (options?.span_id) {
            queryParams.span_id = options.span_id;
        }
        if (options?.operation) {
            queryParams.operation = options.operation;
        }
        if (options?.status) {
            queryParams.status = options.status;
        }
        if (options?.start_time !== undefined) {
            queryParams.start_time = options.start_time;
        }
        if (options?.end_time !== undefined) {
            queryParams.end_time = options.end_time;
        }
        if (options?.root_only) {
            queryParams.root_only = "true";
        }

        // 添加 attributes 过滤器
        if (options?.attributes) {
            for (const [key, value] of Object.entries(options.attributes)) {
                queryParams[`attr.${key}`] = value;
            }
        }

        sendOptions.query = Object.assign({}, sendOptions.query, queryParams);

        return this.client.send("/api/traces", sendOptions);
    }

    /**
     * 获取完整的 Trace 调用链
     *
     * @throws {ClientResponseError}
     */
    async getTrace(traceId: string, options?: CommonOptions): Promise<TraceDetail> {
        if (!traceId) {
            throw new ClientResponseError({
                url: this.client.buildURL("/api/traces/"),
                status: 404,
                response: {
                    code: 404,
                    message: "Missing required trace_id.",
                    data: {},
                },
            });
        }

        const sendOptions = Object.assign({ method: "GET" }, options);

        return this.client.send(
            "/api/traces/" + encodeURIComponent(traceId),
            sendOptions,
        );
    }

    /**
     * 获取 Trace 统计数据
     *
     * @throws {ClientResponseError}
     */
    async getStats(options?: TraceStatsOptions): Promise<TraceStats> {
        const sendOptions = Object.assign({ method: "GET" }, options);

        const queryParams: { [key: string]: any } = {};

        if (options?.start_time !== undefined) {
            queryParams.start_time = options.start_time;
        }
        if (options?.end_time !== undefined) {
            queryParams.end_time = options.end_time;
        }

        sendOptions.query = Object.assign({}, sendOptions.query, queryParams);

        return this.client.send("/api/traces/stats", sendOptions);
    }
}
