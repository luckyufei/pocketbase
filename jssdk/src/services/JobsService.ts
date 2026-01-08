import { BaseService } from "@/services/BaseService";
import { CommonOptions } from "@/tools/options";

/**
 * Job 状态类型
 */
export type JobStatus = "pending" | "processing" | "completed" | "failed";

/**
 * Job 模型
 */
export interface Job {
    id: string;
    topic: string;
    payload: Record<string, any>;
    status: JobStatus;
    run_at: string;
    locked_until?: string;
    retries: number;
    max_retries: number;
    last_error?: string;
    created: string;
    updated: string;
}

/**
 * 入队选项
 */
export interface JobEnqueueOptions {
    /** 调度时间（延时执行），ISO 8601 格式 */
    run_at?: string | Date;
    /** 最大重试次数 */
    max_retries?: number;
}

/**
 * 列表查询选项
 */
export interface JobListOptions extends CommonOptions {
    /** 按 topic 筛选 */
    topic?: string;
    /** 按状态筛选 */
    status?: JobStatus;
    /** 返回数量限制 */
    limit?: number;
    /** 偏移量 */
    offset?: number;
}

/**
 * 列表查询结果
 */
export interface JobListResult {
    items: Job[];
    total: number;
    limit: number;
    offset: number;
}

/**
 * 统计信息
 */
export interface JobStats {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
    success_rate: number;
}

/**
 * JobsService 提供 Jobs API 的客户端封装
 */
export class JobsService extends BaseService {
    /**
     * 入队一个新任务
     *
     * @param topic 任务主题
     * @param payload 任务数据
     * @param options 入队选项
     * @throws {ClientResponseError}
     */
    async enqueue(
        topic: string,
        payload: Record<string, any>,
        options?: JobEnqueueOptions & CommonOptions,
    ): Promise<Job> {
        const body: Record<string, any> = {
            topic,
            payload,
        };

        if (options?.run_at) {
            body.run_at =
                options.run_at instanceof Date
                    ? options.run_at.toISOString()
                    : options.run_at;
        }

        if (options?.max_retries !== undefined) {
            body.max_retries = options.max_retries;
        }

        const sendOptions = Object.assign(
            {
                method: "POST",
                body,
            },
            options,
        );

        // 移除非 SendOptions 的属性
        delete (sendOptions as any).run_at;
        delete (sendOptions as any).max_retries;

        return this.client.send("/api/jobs/enqueue", sendOptions);
    }

    /**
     * 获取单个任务详情
     *
     * @param id 任务 ID
     * @param options 请求选项
     * @throws {ClientResponseError}
     */
    async get(id: string, options?: CommonOptions): Promise<Job> {
        const sendOptions = Object.assign(
            {
                method: "GET",
            },
            options,
        );

        return this.client.send(`/api/jobs/${encodeURIComponent(id)}`, sendOptions);
    }

    /**
     * 获取任务列表
     *
     * @param options 列表查询选项
     * @throws {ClientResponseError}
     */
    async list(options?: JobListOptions): Promise<JobListResult> {
        const query: Record<string, any> = {};

        if (options?.topic) {
            query.topic = options.topic;
        }
        if (options?.status) {
            query.status = options.status;
        }
        if (options?.limit !== undefined) {
            query.limit = options.limit;
        }
        if (options?.offset !== undefined) {
            query.offset = options.offset;
        }

        const sendOptions = Object.assign(
            {
                method: "GET",
                query,
            },
            options,
        );

        // 移除非 SendOptions 的属性
        delete (sendOptions as any).topic;
        delete (sendOptions as any).status;
        delete (sendOptions as any).limit;
        delete (sendOptions as any).offset;

        return this.client.send("/api/jobs", sendOptions);
    }

    /**
     * 重新入队一个失败的任务
     *
     * @param id 任务 ID
     * @param options 请求选项
     * @throws {ClientResponseError}
     */
    async requeue(id: string, options?: CommonOptions): Promise<Job> {
        const sendOptions = Object.assign(
            {
                method: "POST",
            },
            options,
        );

        return this.client.send(
            `/api/jobs/${encodeURIComponent(id)}/requeue`,
            sendOptions,
        );
    }

    /**
     * 删除一个任务（仅 pending 或 failed 状态可删除）
     *
     * @param id 任务 ID
     * @param options 请求选项
     * @throws {ClientResponseError}
     */
    async delete(id: string, options?: CommonOptions): Promise<boolean> {
        const sendOptions = Object.assign(
            {
                method: "DELETE",
            },
            options,
        );

        return this.client
            .send(`/api/jobs/${encodeURIComponent(id)}`, sendOptions)
            .then(() => true);
    }

    /**
     * 获取任务统计信息
     *
     * @param options 请求选项
     * @throws {ClientResponseError}
     */
    async stats(options?: CommonOptions): Promise<JobStats> {
        const sendOptions = Object.assign(
            {
                method: "GET",
            },
            options,
        );

        return this.client.send("/api/jobs/stats", sendOptions);
    }
}
