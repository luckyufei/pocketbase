/**
 * Logger — 结构化日志
 * 与 Go slog API 对齐
 *
 * 支持:
 * - 日志级别过滤 (DEBUG/INFO/WARN/ERROR)
 * - 结构化键值对数据
 * - with() 创建携带上下文的子 logger
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface LoggerConfig {
  level: LogLevel;
  handler?: (entry: LogEntry) => void;
}

export class Logger {
  private level: LogLevel;
  private handler: ((entry: LogEntry) => void) | undefined;
  private contextData: Record<string, unknown>;

  constructor(config: LoggerConfig, contextData: Record<string, unknown> = {}) {
    this.level = config.level;
    this.handler = config.handler;
    this.contextData = contextData;
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, "DEBUG", message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, "INFO", message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, "WARN", message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, "ERROR", message, args);
  }

  /**
   * 创建携带上下文的子 Logger
   * 子 logger 的日志会自动包含父级上下文数据
   */
  with(...args: unknown[]): Logger {
    const data = parseKeyValuePairs(args);
    const mergedContext = { ...this.contextData, ...data };
    return new Logger(
      { level: this.level, handler: this.handler },
      mergedContext,
    );
  }

  private log(level: LogLevel, levelStr: string, message: string, args: unknown[]): void {
    if (level < this.level) return;

    const data = { ...this.contextData, ...parseKeyValuePairs(args) };

    const entry: LogEntry = {
      level: levelStr,
      message,
      data,
      timestamp: new Date(),
    };

    if (this.handler) {
      this.handler(entry);
    }
  }
}

/**
 * 将交替的 key-value 参数解析为对象
 * @example parseKeyValuePairs(["method", "GET", "status", 200]) => { method: "GET", status: 200 }
 */
function parseKeyValuePairs(args: unknown[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = String(args[i]);
    const value = i + 1 < args.length ? args[i + 1] : undefined;
    result[key] = value;
  }
  return result;
}
