/**
 * ProcessMan 插件 — 进程管理
 * 对照 Go 版 plugins/processman/
 *
 * 功能: 进程启停、日志采集、状态监控、自动重启策略、crashed 状态
 */

export type ProcessStatus = "running" | "stopped" | "crashed" | "starting";

export interface ProcessConfig {
  id: string;
  script?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  interpreter?: string;
  maxRetries?: number;
  backoff?: number; // 秒
  devMode?: boolean;
  watchPaths?: string[];
}

export interface ProcessState {
  id: string;
  pid: number | null;
  status: ProcessStatus;
  startTime: Date | null;
  uptime: number; // 秒（运行中实时计算；已停止为 0）
  restartCount: number;
  lastError: string;
}

export interface LogEntry {
  timestamp: Date;
  processId: string;
  stream: "stdout" | "stderr";
  content: string;
}

export interface ProcessManagerConfig {
  configFile?: string;
  maxLogLines?: number; // 每进程最多保留的日志条数，默认 1000
}

export function defaultConfig(): ProcessManagerConfig {
  return {
    configFile: "pb_processes.json",
    maxLogLines: 1000,
  };
}

/**
 * 从环境变量读取配置覆盖（对照 Go 版 applyEnvOverrides）
 *
 * 支持的环境变量：
 *   PB_PROCESSMAN_CONFIG_FILE  — 配置文件路径
 *   PB_PROCESSMAN_MAX_LOG_LINES — 每进程最多保留日志行数（整数）
 */
export function applyEnvOverrides(config: ProcessManagerConfig): ProcessManagerConfig {
  const result = { ...config };

  const configFile = process.env.PB_PROCESSMAN_CONFIG_FILE;
  if (configFile !== undefined) result.configFile = configFile;

  const maxLogLines = process.env.PB_PROCESSMAN_MAX_LOG_LINES;
  if (maxLogLines !== undefined) {
    const n = parseInt(maxLogLines, 10);
    if (!isNaN(n) && n > 0) result.maxLogLines = n;
  }

  return result;
}

export interface ProcessManager {
  list(): ProcessState[];
  getProcess(id: string): ProcessState | null;
  start(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  restart(id: string): Promise<void>;
  crash(id: string, error: string): void;
  getLogs(id: string, lines?: number): LogEntry[];
  addLog(id: string, stream: "stdout" | "stderr", content: string): void;
  clearLogs(id: string): void;
  isRunning(id: string): boolean;
  getConfig(): ProcessManagerConfig;
}

/** 内存实现 */
export class MemoryProcessManager implements ProcessManager {
  private processes: Map<string, ProcessState> = new Map();
  private logs: Map<string, LogEntry[]> = new Map();
  private configs: Map<string, ProcessConfig> = new Map();
  private readonly config: ProcessManagerConfig;
  private readonly maxLogLines: number;

  constructor(config: ProcessManagerConfig) {
    this.config = config;
    this.maxLogLines = config.maxLogLines ?? 1000;
  }

  getConfig(): ProcessManagerConfig {
    return { ...this.config };
  }

  addProcessConfig(config: ProcessConfig): void {
    this.configs.set(config.id, { ...config });
    // 若已存在则保留运行时状态（仅更新配置），否则初始化
    if (!this.processes.has(config.id)) {
      this.processes.set(config.id, {
        id: config.id,
        pid: null,
        status: "stopped",
        startTime: null,
        uptime: 0,
        restartCount: 0,
        lastError: "",
      });
      this.logs.set(config.id, []);
    }
  }

  list(): ProcessState[] {
    return Array.from(this.processes.values()).map((s) => ({
      ...s,
      uptime: this._calcUptime(s),
    }));
  }

  getProcess(id: string): ProcessState | null {
    const s = this.processes.get(id);
    if (!s) return null;
    return { ...s, uptime: this._calcUptime(s) };
  }

  async start(id: string): Promise<void> {
    const state = this.processes.get(id);
    if (!state) throw new Error(`process "${id}" not found`);
    if (state.status === "running") throw new Error(`process "${id}" already running`);
    state.status = "running";
    state.startTime = new Date();
    state.pid = Math.floor(Math.random() * 89999) + 10000;
    state.lastError = "";
  }

  async stop(id: string): Promise<void> {
    const state = this.processes.get(id);
    if (!state) throw new Error(`process "${id}" not found`);
    state.status = "stopped";
    state.pid = null;
    // startTime 保留（记录上次启动时间）
  }

  async restart(id: string): Promise<void> {
    const state = this.processes.get(id);
    if (!state) throw new Error(`process "${id}" not found`);
    // 如果正在运行先停止（已停止/crashed 则直接启动）
    if (state.status === "running") {
      await this.stop(id);
    }
    await this.start(id);
    state.restartCount++;
  }

  /** 标记进程为 crashed，记录错误信息 */
  crash(id: string, error: string): void {
    const state = this.processes.get(id);
    if (!state) throw new Error(`process "${id}" not found`);
    state.status = "crashed";
    state.pid = null;
    state.lastError = error;
  }

  getLogs(id: string, lines = 100): LogEntry[] {
    const allLogs = this.logs.get(id) ?? [];
    return allLogs.slice(-lines);
  }

  addLog(id: string, stream: "stdout" | "stderr", content: string): void {
    if (!this.logs.has(id)) this.logs.set(id, []);
    const bucket = this.logs.get(id)!;
    bucket.push({ timestamp: new Date(), processId: id, stream, content });
    // 超出上限时丢弃最旧的
    if (bucket.length > this.maxLogLines) {
      bucket.splice(0, bucket.length - this.maxLogLines);
    }
  }

  clearLogs(id: string): void {
    if (this.logs.has(id)) this.logs.set(id, []);
  }

  isRunning(id: string): boolean {
    return this.processes.get(id)?.status === "running";
  }

  /** 计算运行中进程的 uptime（秒） */
  private _calcUptime(state: ProcessState): number {
    if (state.status === "running" && state.startTime) {
      return Math.floor((Date.now() - state.startTime.getTime()) / 1000);
    }
    return 0;
  }
}

export function MustRegister(
  _app: unknown,
  config: ProcessManagerConfig = defaultConfig(),
): ProcessManager {
  const resolved = applyEnvOverrides(config);
  return new MemoryProcessManager(resolved);
}
