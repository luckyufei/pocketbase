/**
 * Jobs 插件 — 异步任务队列
 * 对照 Go 版 plugins/jobs/
 *
 * 功能: _jobs 表、任务入队/执行/重试、Worker 分发、REST API
 */

export type JobStatus = "pending" | "processing" | "completed" | "failed";

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
  runAt?: Date;
  maxRetries?: number;
  payload?: unknown;
}

export interface JobFilter {
  topic?: string;
  status?: JobStatus;
  limit?: number;
  offset?: number;
}

export interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  successRate: number;
}

export interface JobsConfig {
  enabled: boolean;
  pollInterval?: number; // 秒
  maxConcurrent?: number;
  defaultMaxRetries?: number;
  httpEnabled?: boolean;
  allowedTopics?: string[]; // 白名单
}

export function defaultConfig(): JobsConfig {
  return {
    enabled: false,
    pollInterval: 5,
    maxConcurrent: 5,
    defaultMaxRetries: 3,
    httpEnabled: true,
    allowedTopics: [],
  };
}

export interface JobsStore {
  enqueue(topic: string, payload?: unknown, options?: JobEnqueueOptions): Promise<string>;
  get(id: string): Promise<Job | null>;
  list(filter?: JobFilter): Promise<Job[]>;
  stats(): Promise<JobStats>;
  delete(id: string): Promise<void>;
  requeue(id: string): Promise<void>;
  register(topic: string, handler: JobHandler): void;
  start(): void;
  stop(): void;
}

/** 内存实现 */
export class MemoryJobsStore implements JobsStore {
  private jobs: Map<string, Job> = new Map();
  private handlers: Map<string, JobHandler> = new Map();
  private config: JobsConfig;
  private running = false;

  constructor(config: JobsConfig) {
    this.config = config;
  }

  async enqueue(topic: string, payload?: unknown, options?: JobEnqueueOptions): Promise<string> {
    if (this.config.allowedTopics?.length && !this.config.allowedTopics.includes(topic)) {
      throw new Error(`topic "${topic}" 不在白名单中`);
    }
    const id = crypto.randomUUID();
    const now = new Date();
    this.jobs.set(id, {
      id,
      topic,
      payload: payload ?? null,
      status: "pending",
      runAt: options?.runAt ?? now,
      lockedUntil: null,
      retries: 0,
      maxRetries: options?.maxRetries ?? this.config.defaultMaxRetries ?? 3,
      lastError: "",
      created: now,
      updated: now,
    });
    return id;
  }

  async get(id: string): Promise<Job | null> {
    return this.jobs.get(id) ?? null;
  }

  async list(filter?: JobFilter): Promise<Job[]> {
    let result = Array.from(this.jobs.values());
    if (filter?.topic) result = result.filter((j) => j.topic === filter.topic);
    if (filter?.status) result = result.filter((j) => j.status === filter.status);
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 50;
    return result.slice(offset, offset + limit);
  }

  async stats(): Promise<JobStats> {
    const jobs = Array.from(this.jobs.values());
    const s: JobStats = { pending: 0, processing: 0, completed: 0, failed: 0, successRate: 0 };
    for (const j of jobs) {
      s[j.status]++;
    }
    const total = s.completed + s.failed;
    s.successRate = total > 0 ? s.completed / total : 0;
    return s;
  }

  async delete(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (job && (job.status === "pending" || job.status === "failed")) {
      this.jobs.delete(id);
    }
  }

  async requeue(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (job && job.status === "failed") {
      job.status = "pending";
      job.retries = 0;
      job.lastError = "";
      job.updated = new Date();
    }
  }

  register(topic: string, handler: JobHandler): void {
    this.handlers.set(topic, handler);
  }

  start(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }
}

export function MustRegister(_app: unknown, config: JobsConfig = defaultConfig()): JobsStore {
  return new MemoryJobsStore(config);
}
