/**
 * ProcessMan 插件 — 进程管理
 * 对照 Go 版 plugins/processman/
 *
 * 功能: 进程启停、日志采集、状态监控、自动重启
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
  uptime: number; // 秒
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
}

export function defaultConfig(): ProcessManagerConfig {
  return {
    configFile: "pb_processes.json",
  };
}

export interface ProcessManager {
  list(): ProcessState[];
  start(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  restart(id: string): Promise<void>;
  getLogs(id: string, lines?: number): LogEntry[];
  isRunning(id: string): boolean;
}

/** 内存实现 */
export class MemoryProcessManager implements ProcessManager {
  private processes: Map<string, ProcessState> = new Map();
  private logs: Map<string, LogEntry[]> = new Map();
  private configs: Map<string, ProcessConfig> = new Map();

  constructor(_config: ProcessManagerConfig) {}

  addProcessConfig(config: ProcessConfig): void {
    this.configs.set(config.id, config);
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

  list(): ProcessState[] {
    return Array.from(this.processes.values());
  }

  async start(id: string): Promise<void> {
    const state = this.processes.get(id);
    if (!state) throw new Error(`process "${id}" not found`);
    if (state.status === "running") throw new Error(`process "${id}" already running`);
    state.status = "running";
    state.startTime = new Date();
    state.pid = Math.floor(Math.random() * 99999) + 1000;
  }

  async stop(id: string): Promise<void> {
    const state = this.processes.get(id);
    if (!state) throw new Error(`process "${id}" not found`);
    state.status = "stopped";
    state.pid = null;
  }

  async restart(id: string): Promise<void> {
    await this.stop(id);
    await this.start(id);
    const state = this.processes.get(id)!;
    state.restartCount++;
  }

  getLogs(id: string, lines = 100): LogEntry[] {
    const allLogs = this.logs.get(id) ?? [];
    return allLogs.slice(-lines);
  }

  isRunning(id: string): boolean {
    return this.processes.get(id)?.status === "running";
  }
}

export function MustRegister(_app: unknown, config: ProcessManagerConfig = defaultConfig()): ProcessManager {
  return new MemoryProcessManager(config);
}
