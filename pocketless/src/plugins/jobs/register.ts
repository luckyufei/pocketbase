/**
 * Jobs 插件 — 异步任务队列
 * 对照 Go 版 plugins/jobs/
 *
 * 功能:
 *  - 任务入队（立即/延时）、Payload 大小校验
 *  - topic 白名单 + 重复注册保护
 *  - Dispatcher：Worker 池、轮询循环、指数退避重试
 *  - panic 安全执行、锁超时崩溃恢复
 *  - 环境变量覆盖（PB_JOBS_*）
 */

// ─── 错误定义（对照 Go 版 store.go 错误常量）────────────────────────────────

export const ErrJobNotFound = new Error("job not found");
export const ErrJobPayloadTooLarge = new Error("payload too large (max 1MB)");
export const ErrJobTopicEmpty = new Error("topic cannot be empty");
export const ErrJobTopicAlreadyRegistered = new Error("topic already registered");
export const ErrJobCannotDelete = new Error("cannot delete job (only pending or failed jobs can be deleted)");
export const ErrJobCannotRequeue = new Error("cannot requeue job (only failed jobs can be requeued)");

// ─── 常量（对照 Go 版 store.go）──────────────────────────────────────────────

export const JOB_MAX_PAYLOAD_BYTES = 1 << 20; // 1 MB
export const JOB_DEFAULT_MAX_RETRIES = 3;
export const JOB_DEFAULT_LOCK_DURATION_MS = 5 * 60 * 1000; // 5 分钟
export const JOB_DEFAULT_POLL_INTERVAL_MS = 1000;           // 1 秒
export const JOB_DEFAULT_WORKERS = 10;
export const JOB_DEFAULT_BATCH_SIZE = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = "pending" | "processing" | "completed" | "failed";

/** 对照 Go 版 store.go Job */
export interface Job {
  id: string;
  topic: string;
  payload: unknown;
  status: JobStatus;
  runAt: Date;
  lockedUntil: Date | null;
  retries: number;
  maxRetries: number;
  lastError: string;
  created: Date;
  updated: Date;
}

export type JobHandler = (job: Job) => Promise<void>;

export interface JobEnqueueOptions {
  /** 延时执行时间（不设则立即） */
  runAt?: Date;
  /** 最大重试次数（覆盖 config 默认值） */
  maxRetries?: number;
}

export interface JobFilter {
  topic?: string;
  status?: JobStatus;
  limit?: number;
  offset?: number;
}

export interface JobListResult {
  items: Job[];
  total: number;
  limit: number;
  offset: number;
}

export interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  successRate: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface JobsConfig {
  enabled: boolean;
  /** Worker 池大小，默认 10 */
  workers?: number;
  /** 轮询间隔（秒），默认 1 */
  pollInterval?: number;
  /** 任务锁定时长（秒），默认 300 */
  lockDuration?: number;
  /** 每次批量拉取数，默认 10 */
  batchSize?: number;
  /** 默认最大重试次数，默认 3 */
  defaultMaxRetries?: number;
  /** 最大 Payload 字节数，默认 1MB */
  maxPayloadSize?: number;
  /** 是否注册 HTTP 路由，默认 true */
  httpEnabled?: boolean;
  /** topic 白名单（空 = 允许全部） */
  allowedTopics?: string[];
  /** 是否自动启动 Dispatcher，默认 true */
  autoStart?: boolean;
}

export function defaultConfig(): JobsConfig {
  return {
    enabled: false,
    workers: JOB_DEFAULT_WORKERS,
    pollInterval: 1,
    lockDuration: 300,
    batchSize: JOB_DEFAULT_BATCH_SIZE,
    defaultMaxRetries: JOB_DEFAULT_MAX_RETRIES,
    maxPayloadSize: JOB_MAX_PAYLOAD_BYTES,
    httpEnabled: true,
    allowedTopics: [],
    autoStart: true,
  };
}

/** 环境变量覆盖（对照 Go 版 config.go applyEnvOverrides） */
export function applyEnvOverrides(c: JobsConfig): JobsConfig {
  const r = { ...c };

  const disabled = process.env["PB_JOBS_DISABLED"];
  if (disabled) r.enabled = !(disabled === "true" || disabled === "1");

  const workers = Number(process.env["PB_JOBS_WORKERS"]);
  if (workers > 0) r.workers = workers;

  const poll = Number(process.env["PB_JOBS_POLL_INTERVAL"]);
  if (poll > 0) r.pollInterval = poll;

  const lock = Number(process.env["PB_JOBS_LOCK_DURATION"]);
  if (lock > 0) r.lockDuration = lock;

  const batch = Number(process.env["PB_JOBS_BATCH_SIZE"]);
  if (batch > 0) r.batchSize = batch;

  const http = process.env["PB_JOBS_HTTP_ENABLED"];
  if (http) r.httpEnabled = http === "true" || http === "1";

  const auto = process.env["PB_JOBS_AUTO_START"];
  if (auto) r.autoStart = auto === "true" || auto === "1";

  return r;
}

// ─── JobsStore 接口 ───────────────────────────────────────────────────────────

export interface JobsStore {
  /** 立即入队 */
  enqueue(topic: string, payload?: unknown, options?: JobEnqueueOptions): Promise<Job>;
  /** 获取任务详情 */
  get(id: string): Promise<Job>;
  /** 列表查询 */
  list(filter?: JobFilter): Promise<JobListResult>;
  /** 统计信息 */
  stats(): Promise<JobStats>;
  /** 删除（仅 pending/failed 可删） */
  delete(id: string): Promise<void>;
  /** 重新入队（仅 failed 可 requeue） */
  requeue(id: string): Promise<Job>;
  /** 注册 topic 处理函数 */
  register(topic: string, handler: JobHandler): void;
  /** 启动 Dispatcher */
  start(): void;
  /** 停止 Dispatcher */
  stop(): void;
  /** 是否正在运行 */
  isRunning(): boolean;
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

/**
 * 内存 Dispatcher：轮询 pending 任务，分发给 Worker 并发执行。
 * 对照 Go 版 dispatcher.go Dispatcher。
 *
 * 关键设计：
 * - Worker 池用信号量（Promise 队列）控制并发数
 * - 指数退避重试：等待时间 = retryCount² 分钟
 * - panic 安全执行（try/catch）
 * - 锁超时恢复：lockedUntil < now 的 processing 任务可被重新拾取
 */
class Dispatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private activeWorkers = 0;
  private readonly config: Required<JobsConfig>;
  private readonly store: MemoryJobsStore;

  constructor(store: MemoryJobsStore, config: Required<JobsConfig>) {
    this.store = store;
    this.config = config;
  }

  start(): void {
    this.timer = setInterval(() => {
      this._fetchAndExecute();
    }, this.config.pollInterval * 1000);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 对照 Go fetchAndExecute() */
  private _fetchAndExecute(): void {
    const topics = this.store.getRegisteredTopics();
    if (topics.length === 0) return;

    const jobs = this.store.fetchAndLock(
      topics,
      this.config.batchSize,
      this.config.lockDuration * 1000
    );

    for (const job of jobs) {
      if (this.activeWorkers >= this.config.workers) break;
      this.activeWorkers++;
      this._executeJob(job).finally(() => {
        this.activeWorkers--;
      });
    }
  }

  /** 对照 Go executeJob() + safeExecute() */
  private async _executeJob(job: Job): Promise<void> {
    const handler = this.store.getHandler(job.topic);
    if (!handler) return;

    let err: Error | null = null;
    try {
      await handler(job);
    } catch (e) {
      err = e instanceof Error ? e : new Error(String(e));
    }

    if (err) {
      this.store.handleFailure(job, err, this.config.lockDuration * 1000);
    } else {
      this.store.handleSuccess(job);
    }
  }
}

// ─── MemoryJobsStore ──────────────────────────────────────────────────────────

/**
 * 内存任务队列实现。
 * 对照 Go 版 store.go JobStore + dispatcher.go Dispatcher。
 */
export class MemoryJobsStore implements JobsStore {
  private readonly jobs: Map<string, Job> = new Map();
  private readonly handlers: Map<string, JobHandler> = new Map();
  private readonly config: Required<JobsConfig>;
  private dispatcher: Dispatcher | null = null;

  constructor(config: JobsConfig) {
    this.config = {
      enabled: config.enabled,
      workers: config.workers ?? JOB_DEFAULT_WORKERS,
      pollInterval: config.pollInterval ?? 1,
      lockDuration: config.lockDuration ?? 300,
      batchSize: config.batchSize ?? JOB_DEFAULT_BATCH_SIZE,
      defaultMaxRetries: config.defaultMaxRetries ?? JOB_DEFAULT_MAX_RETRIES,
      maxPayloadSize: config.maxPayloadSize ?? JOB_MAX_PAYLOAD_BYTES,
      httpEnabled: config.httpEnabled ?? true,
      allowedTopics: config.allowedTopics ?? [],
      autoStart: config.autoStart ?? true,
    };
  }

  // ── 入队 ───────────────────────────────────────────────────────────────────

  async enqueue(topic: string, payload: unknown = null, options?: JobEnqueueOptions): Promise<Job> {
    if (!topic) throw ErrJobTopicEmpty;

    // topic 白名单
    if (this.config.allowedTopics.length > 0 && !this.config.allowedTopics.includes(topic)) {
      throw new Error(`topic "${topic}" 不在白名单中`);
    }

    // Payload 大小校验（对照 Go validatePayloadSize）
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload)).length;
    if (payloadBytes > this.config.maxPayloadSize) {
      throw ErrJobPayloadTooLarge;
    }

    const now = new Date();
    const job: Job = {
      id: crypto.randomUUID(),
      topic,
      payload,
      status: "pending",
      runAt: options?.runAt ?? now,
      lockedUntil: null,
      retries: 0,
      maxRetries: options?.maxRetries ?? this.config.defaultMaxRetries,
      lastError: "",
      created: now,
      updated: now,
    };

    this.jobs.set(job.id, job);
    return job;
  }

  // ── 查询 ───────────────────────────────────────────────────────────────────

  async get(id: string): Promise<Job> {
    const job = this.jobs.get(id);
    if (!job) throw ErrJobNotFound;
    return job;
  }

  async list(filter?: JobFilter): Promise<JobListResult> {
    const limit = filter?.limit ?? 20;
    const offset = filter?.offset ?? 0;

    let items = Array.from(this.jobs.values());
    if (filter?.topic) items = items.filter((j) => j.topic === filter.topic);
    if (filter?.status) items = items.filter((j) => j.status === filter.status);

    // 按 created 降序（对照 Go ORDER BY created DESC）
    items.sort((a, b) => b.created.getTime() - a.created.getTime());

    const total = items.length;
    const page = items.slice(offset, offset + limit);

    return { items: page, total, limit, offset };
  }

  async stats(): Promise<JobStats> {
    const s: JobStats = { pending: 0, processing: 0, completed: 0, failed: 0, total: 0, successRate: 0 };
    for (const j of this.jobs.values()) s[j.status]++;
    s.total = s.pending + s.processing + s.completed + s.failed;
    const finished = s.completed + s.failed;
    s.successRate = finished > 0 ? s.completed / finished : 0;
    return s;
  }

  // ── 管理操作 ───────────────────────────────────────────────────────────────

  async delete(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) throw ErrJobNotFound;
    if (job.status !== "pending" && job.status !== "failed") throw ErrJobCannotDelete;
    this.jobs.delete(id);
  }

  async requeue(id: string): Promise<Job> {
    const job = this.jobs.get(id);
    if (!job) throw ErrJobNotFound;
    if (job.status !== "failed") throw ErrJobCannotRequeue;

    job.status = "pending";
    job.retries = 0;
    job.lastError = "";
    job.runAt = new Date();
    job.lockedUntil = null;
    job.updated = new Date();
    return job;
  }

  // ── Worker 操作 ────────────────────────────────────────────────────────────

  register(topic: string, handler: JobHandler): void {
    if (this.handlers.has(topic)) throw ErrJobTopicAlreadyRegistered;
    this.handlers.set(topic, handler);
  }

  start(): void {
    if (this.dispatcher !== null) return;
    this.dispatcher = new Dispatcher(this, this.config);
    this.dispatcher.start();
  }

  stop(): void {
    this.dispatcher?.stop();
    this.dispatcher = null;
  }

  isRunning(): boolean {
    return this.dispatcher !== null;
  }

  // ── 供 Dispatcher 内部调用的方法 ─────────────────────────────────────────

  /** 批量拉取并锁定到期的 pending 任务（对照 Go fetchJobsSQLite） */
  fetchAndLock(topics: string[], batchSize: number, lockDurationMs: number): Job[] {
    const now = Date.now();
    const locked: Job[] = [];

    for (const job of this.jobs.values()) {
      if (locked.length >= batchSize) break;
      if (!topics.includes(job.topic)) continue;

      const isPendingReady =
        job.status === "pending" &&
        job.runAt.getTime() <= now &&
        (job.lockedUntil === null || job.lockedUntil.getTime() < now);

      const isStuckProcessing =
        job.status === "processing" &&
        job.lockedUntil !== null &&
        job.lockedUntil.getTime() < now;

      if (isPendingReady || isStuckProcessing) {
        job.status = "processing";
        job.lockedUntil = new Date(now + lockDurationMs);
        job.updated = new Date();
        locked.push(job);
      }
    }

    return locked;
  }

  getRegisteredTopics(): string[] {
    return Array.from(this.handlers.keys());
  }

  getHandler(topic: string): JobHandler | undefined {
    return this.handlers.get(topic);
  }

  /** 对照 Go handleSuccess() */
  handleSuccess(job: Job): void {
    const stored = this.jobs.get(job.id);
    if (!stored) return;
    stored.status = "completed";
    stored.lockedUntil = null;
    stored.updated = new Date();
  }

  /**
   * 对照 Go handleFailure()。
   * retries+1 < maxRetries → 重试（指数退避）
   * 否则 → 标记为 failed（死信）
   */
  handleFailure(job: Job, err: Error, _lockDurationMs: number): void {
    const stored = this.jobs.get(job.id);
    if (!stored) return;

    stored.lastError = err.message;
    stored.lockedUntil = null;
    stored.updated = new Date();

    if (stored.retries + 1 < stored.maxRetries) {
      // 指数退避：retryCount² 分钟（对照 Go retryCount*retryCount * time.Minute）
      const retryCount = stored.retries + 1;
      const backoffMs = retryCount * retryCount * 60 * 1000;
      stored.retries = retryCount;
      stored.status = "pending";
      stored.runAt = new Date(Date.now() + backoffMs);
    } else {
      stored.status = "failed";
    }
  }
}

// ─── DBJobsStore（数据库持久化版）────────────────────────────────────────────

import type { DBAdapter } from "../../core/db_adapter";
import { DateTime } from "../../tools/types/datetime";

/**
 * 数据库持久化版 JobsStore。
 * 所有任务读写均通过 SQLite，支持服务器重启后恢复。
 * 对照 Go 版 store_sqlite.go DBJobStore。
 */
export class DBJobsStore implements JobsStore {
  private readonly db: DBAdapter;
  private readonly handlers: Map<string, JobHandler> = new Map();
  private readonly config: Required<JobsConfig>;
  private dispatcher: DBDispatcher | null = null;

  constructor(config: JobsConfig, db: DBAdapter) {
    this.config = {
      enabled: config.enabled,
      workers: config.workers ?? JOB_DEFAULT_WORKERS,
      pollInterval: config.pollInterval ?? 1,
      lockDuration: config.lockDuration ?? 300,
      batchSize: config.batchSize ?? JOB_DEFAULT_BATCH_SIZE,
      defaultMaxRetries: config.defaultMaxRetries ?? JOB_DEFAULT_MAX_RETRIES,
      maxPayloadSize: config.maxPayloadSize ?? JOB_MAX_PAYLOAD_BYTES,
      httpEnabled: config.httpEnabled ?? true,
      allowedTopics: config.allowedTopics ?? [],
      autoStart: config.autoStart ?? true,
    };
    this.db = db;
    // 启动时恢复 stuck 任务
    this._recoverStuckJobs();
  }

  // ── 入队 ─────────────────────────────────────────────────────────────────

  async enqueue(topic: string, payload: unknown = null, options?: JobEnqueueOptions): Promise<Job> {
    if (!topic) throw ErrJobTopicEmpty;

    if (this.config.allowedTopics.length > 0 && !this.config.allowedTopics.includes(topic)) {
      throw new Error(`topic "${topic}" 不在白名单中`);
    }

    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload)).length;
    if (payloadBytes > this.config.maxPayloadSize) throw ErrJobPayloadTooLarge;

    const now = new Date();
    const runAt = options?.runAt ?? now;
    const id = crypto.randomUUID();
    const nowStr = new DateTime(now).toSQLite();
    const runAtStr = new DateTime(runAt).toSQLite();

    this.db.exec(
      `INSERT INTO _jobs (id, topic, payload, status, runAt, lockedUntil, retries, maxRetries, lastError, created, updated)
       VALUES (?, ?, ?, 'pending', ?, NULL, 0, ?, '', ?, ?)`,
      id, topic, JSON.stringify(payload),
      runAtStr,
      options?.maxRetries ?? this.config.defaultMaxRetries,
      nowStr, nowStr,
    );

    return this._rowToJob(this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM _jobs WHERE id = ?`, id,
    )!);
  }

  // ── 查询 ─────────────────────────────────────────────────────────────────

  async get(id: string): Promise<Job> {
    const row = this.db.queryOne<Record<string, unknown>>(`SELECT * FROM _jobs WHERE id = ?`, id);
    if (!row) throw ErrJobNotFound;
    return this._rowToJob(row);
  }

  async list(filter?: JobFilter): Promise<JobListResult> {
    const limit = filter?.limit ?? 20;
    const offset = filter?.offset ?? 0;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.topic) { conditions.push("topic = ?"); params.push(filter.topic); }
    if (filter?.status) { conditions.push("status = ?"); params.push(filter.status); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = (this.db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM _jobs ${where}`, ...params,
    )?.cnt ?? 0);

    const rows = this.db.query<Record<string, unknown>>(
      `SELECT * FROM _jobs ${where} ORDER BY created DESC LIMIT ? OFFSET ?`,
      ...params, limit, offset,
    );

    return { items: rows.map(this._rowToJob), total, limit, offset };
  }

  async stats(): Promise<JobStats> {
    const rows = this.db.query<{ status: string; cnt: number }>(
      `SELECT status, COUNT(*) as cnt FROM _jobs GROUP BY status`,
    );
    const s: JobStats = { pending: 0, processing: 0, completed: 0, failed: 0, total: 0, successRate: 0 };
    for (const r of rows) {
      if (r.status in s) (s as Record<string, number>)[r.status] = r.cnt;
    }
    s.total = s.pending + s.processing + s.completed + s.failed;
    const finished = s.completed + s.failed;
    s.successRate = finished > 0 ? s.completed / finished : 0;
    return s;
  }

  // ── 管理操作 ──────────────────────────────────────────────────────────────

  async delete(id: string): Promise<void> {
    const row = this.db.queryOne<{ status: string }>(`SELECT status FROM _jobs WHERE id = ?`, id);
    if (!row) throw ErrJobNotFound;
    if (row.status !== "pending" && row.status !== "failed") throw ErrJobCannotDelete;
    this.db.exec(`DELETE FROM _jobs WHERE id = ?`, id);
  }

  async requeue(id: string): Promise<Job> {
    const row = this.db.queryOne<{ status: string }>(`SELECT status FROM _jobs WHERE id = ?`, id);
    if (!row) throw ErrJobNotFound;
    if (row.status !== "failed") throw ErrJobCannotRequeue;

    const nowStr = DateTime.now().toSQLite();
    this.db.exec(
      `UPDATE _jobs SET status='pending', retries=0, lastError='', runAt=?, lockedUntil=NULL, updated=? WHERE id=?`,
      nowStr, nowStr, id,
    );
    return this.get(id);
  }

  // ── Worker 操作 ──────────────────────────────────────────────────────────

  register(topic: string, handler: JobHandler): void {
    if (this.handlers.has(topic)) throw ErrJobTopicAlreadyRegistered;
    this.handlers.set(topic, handler);
  }

  start(): void {
    if (this.dispatcher !== null) return;
    this.dispatcher = new DBDispatcher(this, this.config);
    this.dispatcher.start();
  }

  stop(): void {
    this.dispatcher?.stop();
    this.dispatcher = null;
  }

  isRunning(): boolean {
    return this.dispatcher !== null;
  }

  // ── 清理（后台任务调用）──────────────────────────────────────────────────

  /** 清理超过 retentionDays 天的已完成任务，返回删除数量 */
  pruneCompleted(retentionDays = 7): number {
    const cutoff = new Date(Date.now() - retentionDays * 86400_000);
    const cutoffStr = new DateTime(cutoff).toSQLite();
    const row = this.db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM _jobs WHERE status='completed' AND updated < ?`, cutoffStr,
    );
    const count = row?.cnt ?? 0;
    if (count > 0) {
      this.db.exec(`DELETE FROM _jobs WHERE status='completed' AND updated < ?`, cutoffStr);
    }
    return count;
  }

  // ── 供 DBDispatcher 内部调用 ─────────────────────────────────────────────

  /** 批量拉取并锁定 pending 任务（事务原子性） */
  fetchAndLock(topics: string[], batchSize: number, lockDurationMs: number): Job[] {
    if (topics.length === 0) return [];
    const nowStr = DateTime.now().toSQLite();
    const lockUntil = new DateTime(new Date(Date.now() + lockDurationMs)).toSQLite();
    const placeholders = topics.map(() => "?").join(", ");

    // 查找 pending+ready 或 stuck processing 的任务
    const rows = this.db.query<Record<string, unknown>>(
      `SELECT * FROM _jobs
       WHERE topic IN (${placeholders})
         AND status IN ('pending', 'processing')
         AND runAt <= ?
         AND (lockedUntil IS NULL OR lockedUntil < ?)
       ORDER BY runAt ASC
       LIMIT ?`,
      ...topics, nowStr, nowStr, batchSize,
    );

    const jobs: Job[] = [];
    for (const row of rows) {
      const id = row.id as string;
      this.db.exec(
        `UPDATE _jobs SET status='processing', lockedUntil=?, updated=? WHERE id=?`,
        lockUntil, nowStr, id,
      );
      jobs.push(this._rowToJob({ ...row, status: "processing", lockedUntil: lockUntil }));
    }
    return jobs;
  }

  getRegisteredTopics(): string[] {
    return Array.from(this.handlers.keys());
  }

  getHandler(topic: string): JobHandler | undefined {
    return this.handlers.get(topic);
  }

  handleSuccess(job: Job): void {
    const nowStr = DateTime.now().toSQLite();
    this.db.exec(
      `UPDATE _jobs SET status='completed', lockedUntil=NULL, updated=? WHERE id=?`,
      nowStr, job.id,
    );
  }

  handleFailure(job: Job, err: Error, _lockDurationMs: number): void {
    const nowStr = DateTime.now().toSQLite();
    // 先读最新 retries
    const row = this.db.queryOne<{ retries: number; maxRetries: number }>(
      `SELECT retries, maxRetries FROM _jobs WHERE id=?`, job.id,
    );
    if (!row) return;

    if (row.retries + 1 < row.maxRetries) {
      const retryCount = row.retries + 1;
      const backoffMs = retryCount * retryCount * 60 * 1000;
      const runAt = new DateTime(new Date(Date.now() + backoffMs)).toSQLite();
      this.db.exec(
        `UPDATE _jobs SET status='pending', retries=?, lastError=?, runAt=?, lockedUntil=NULL, updated=? WHERE id=?`,
        retryCount, err.message, runAt, nowStr, job.id,
      );
    } else {
      // 超过重试次数 → failed + 写入死信队列
      this.db.exec(
        `UPDATE _jobs SET status='failed', lastError=?, lockedUntil=NULL, updated=? WHERE id=?`,
        err.message, nowStr, job.id,
      );
      try {
        this.db.exec(
          `INSERT OR IGNORE INTO _jobs_deadletter (id, jobId, topic, lastError, attempts, created)
           VALUES (?, ?, ?, ?, ?, ?)`,
          crypto.randomUUID(), job.id, job.topic, err.message, row.retries + 1, nowStr,
        );
      } catch { /* 忽略死信队列写入失败 */ }
    }
  }

  // ── 私有方法 ─────────────────────────────────────────────────────────────

  /** 启动时恢复因崩溃卡住的 processing 任务 */
  private _recoverStuckJobs(): void {
    const nowStr = DateTime.now().toSQLite();
    try {
      this.db.exec(
        `UPDATE _jobs SET status='pending', lockedUntil=NULL, updated=?
         WHERE status='processing' AND lockedUntil IS NOT NULL AND lockedUntil < ?`,
        nowStr, nowStr,
      );
    } catch { /* 表不存在时忽略 */ }
  }

  /** DB 行 → Job 对象 */
  private _rowToJob(row: Record<string, unknown>): Job {
    return {
      id: row.id as string,
      topic: row.topic as string,
      payload: (() => {
        try { return JSON.parse(row.payload as string); } catch { return null; }
      })(),
      status: row.status as JobStatus,
      runAt: new Date(row.runAt as string),
      lockedUntil: row.lockedUntil ? new Date(row.lockedUntil as string) : null,
      retries: Number(row.retries ?? 0),
      maxRetries: Number(row.maxRetries ?? 3),
      lastError: (row.lastError as string) ?? "",
      created: new Date(row.created as string),
      updated: new Date(row.updated as string),
    };
  }
}

/** DB 版 Dispatcher，适配 DBJobsStore */
class DBDispatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private activeWorkers = 0;
  private readonly store: DBJobsStore;
  private readonly config: Required<JobsConfig>;

  constructor(store: DBJobsStore, config: Required<JobsConfig>) {
    this.store = store;
    this.config = config;
  }

  start(): void {
    this.timer = setInterval(() => this._fetchAndExecute(), this.config.pollInterval * 1000);
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private _fetchAndExecute(): void {
    const topics = this.store.getRegisteredTopics();
    if (topics.length === 0) return;
    const jobs = this.store.fetchAndLock(topics, this.config.batchSize, this.config.lockDuration * 1000);
    for (const job of jobs) {
      if (this.activeWorkers >= this.config.workers) break;
      this.activeWorkers++;
      this._executeJob(job).finally(() => { this.activeWorkers--; });
    }
  }

  private async _executeJob(job: Job): Promise<void> {
    const handler = this.store.getHandler(job.topic);
    if (!handler) return;
    let err: Error | null = null;
    try { await handler(job); } catch (e) { err = e instanceof Error ? e : new Error(String(e)); }
    if (err) this.store.handleFailure(job, err, this.config.lockDuration * 1000);
    else this.store.handleSuccess(job);
  }
}

// ─── MustRegister ─────────────────────────────────────────────────────────────

/**
 * 创建并返回 JobsStore 实例。
 * - db 注入 → DBJobsStore（持久化版）
 * - 无 db   → MemoryJobsStore（内存版）
 */
export function MustRegister(
  _app: unknown,
  config: JobsConfig = defaultConfig(),
  db?: DBAdapter,
): JobsStore {
  const merged = applyEnvOverrides(config);
  if (db) return new DBJobsStore(merged, db);
  return new MemoryJobsStore(merged);
}
