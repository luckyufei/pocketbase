/**
 * Cron scheduler wrapper — 基于 croner 的定时任务调度器
 * 与 Go 版 tools/cron 对齐：Schedule, Job, Cron
 */

// ==================== Moment ====================

/** 时间快照，用于 Schedule.isDue 检查 */
export interface Moment {
  minute: number;     // 0-59
  hour: number;       // 0-23
  day: number;        // 1-31
  month: number;      // 1-12
  dayOfWeek: number;  // 0-6 (Sunday=0)
}

/** 从 Date 创建 Moment */
export function newMoment(date: Date): Moment {
  return {
    minute: date.getMinutes(),
    hour: date.getHours(),
    day: date.getDate(),
    month: date.getMonth() + 1, // 1-based
    dayOfWeek: date.getDay(),
  };
}

// ==================== Schedule ====================

/** 宏映射 */
const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

/** 各字段范围 [min, max] */
const FIELD_RANGES: [number, number][] = [
  [0, 59],   // minute
  [0, 23],   // hour
  [1, 31],   // day
  [1, 12],   // month
  [0, 6],    // dayOfWeek
];

/**
 * Schedule — 解析的 cron 调度表达式
 * 支持 5 段标准格式 + 宏
 */
export class Schedule {
  minutes: Set<number>;
  hours: Set<number>;
  days: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;

  private constructor(
    minutes: Set<number>,
    hours: Set<number>,
    days: Set<number>,
    months: Set<number>,
    daysOfWeek: Set<number>,
  ) {
    this.minutes = minutes;
    this.hours = hours;
    this.days = days;
    this.months = months;
    this.daysOfWeek = daysOfWeek;
  }

  /** 解析 cron 表达式 */
  static parse(expr: string): Schedule {
    const trimmed = expr.trim();

    // 检查宏
    if (trimmed.startsWith("@")) {
      const resolved = MACROS[trimmed.toLowerCase()];
      if (!resolved) {
        throw new Error(`unsupported cron macro: ${trimmed}`);
      }
      return Schedule.parse(resolved);
    }

    const segments = trimmed.split(/\s+/);
    if (segments.length !== 5) {
      throw new Error(`invalid cron expression: expected 5 segments, got ${segments.length}`);
    }

    const fields: Set<number>[] = [];
    for (let i = 0; i < 5; i++) {
      fields.push(parseField(segments[i], FIELD_RANGES[i][0], FIELD_RANGES[i][1]));
    }

    return new Schedule(fields[0], fields[1], fields[2], fields[3], fields[4]);
  }

  /** 检查 Moment 是否匹配此调度 */
  isDue(m: Moment): boolean {
    return (
      this.minutes.has(m.minute) &&
      this.hours.has(m.hour) &&
      this.days.has(m.day) &&
      this.months.has(m.month) &&
      this.daysOfWeek.has(m.dayOfWeek)
    );
  }
}

/**
 * 解析单个字段（支持 *, 范围, 步进, 列表）
 */
function parseField(field: string, min: number, max: number): Set<number> {
  const result = new Set<number>();
  const parts = field.split(",");

  for (const part of parts) {
    // 步进: */n 或 range/n
    if (part.includes("/")) {
      const [rangePart, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step <= 0) {
        throw new Error(`invalid step value: ${stepStr}`);
      }

      let start = min;
      let end = max;
      if (rangePart !== "*") {
        if (rangePart.includes("-")) {
          [start, end] = parseRange(rangePart, min, max);
        } else {
          start = parseInt(rangePart, 10);
          if (isNaN(start)) throw new Error(`invalid field value: ${rangePart}`);
        }
      }

      for (let i = start; i <= end; i += step) {
        result.add(i);
      }
    } else if (part === "*") {
      // 通配
      for (let i = min; i <= max; i++) {
        result.add(i);
      }
    } else if (part.includes("-")) {
      // 范围
      const [start, end] = parseRange(part, min, max);
      for (let i = start; i <= end; i++) {
        result.add(i);
      }
    } else {
      // 单值
      const val = parseInt(part, 10);
      if (isNaN(val) || val < min || val > max) {
        throw new Error(`invalid value ${part} (expected ${min}-${max})`);
      }
      result.add(val);
    }
  }

  return result;
}

/** 解析范围 "start-end" */
function parseRange(rangeStr: string, min: number, max: number): [number, number] {
  const [startStr, endStr] = rangeStr.split("-");
  const start = parseInt(startStr, 10);
  const end = parseInt(endStr, 10);
  if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
    throw new Error(`invalid range: ${rangeStr} (expected ${min}-${max})`);
  }
  return [start, end];
}

// ==================== Job ====================

/**
 * Job — 注册的定时任务
 * 对齐 Go 版 cron.Job
 */
export class Job {
  private _id: string;
  private _expression: string;
  private _fn: (() => void) | null;

  constructor(id: string, expression: string, fn: (() => void) | null) {
    this._id = id;
    this._expression = expression;
    this._fn = fn;
  }

  get id(): string {
    return this._id;
  }

  get expression(): string {
    return this._expression;
  }

  /** 执行任务（nil-safe） */
  run(): void {
    if (this._fn) {
      this._fn();
    }
  }

  /** JSON 序列化 */
  toJSON(): { id: string; expression: string } {
    return { id: this._id, expression: this._expression };
  }
}

// ==================== Cron ====================

/**
 * Cron — 定时任务调度器
 * 对齐 Go 版 tools/cron.Cron
 */
export class Cron {
  private _jobs: Map<string, Job> = new Map();
  private _schedules: Map<string, Schedule> = new Map();
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _started: boolean = false;

  /** 检查间隔（毫秒，默认 60000 = 1 分钟） */
  interval: number = 60000;

  /** 时区（默认 UTC） */
  timezone: string = "UTC";

  /** 添加定时任务 */
  add(jobId: string, cronExpr: string, fn: () => void): void {
    const schedule = Schedule.parse(cronExpr);
    this._jobs.set(jobId, new Job(jobId, cronExpr, fn));
    this._schedules.set(jobId, schedule);
  }

  /** 添加定时任务（无效表达式时抛错） */
  mustAdd(jobId: string, cronExpr: string, fn: () => void): void {
    this.add(jobId, cronExpr, fn);
  }

  /** 移除定时任务 */
  remove(jobId: string): void {
    this._jobs.delete(jobId);
    this._schedules.delete(jobId);
  }

  /** 移除所有任务 */
  removeAll(): void {
    this._jobs.clear();
    this._schedules.clear();
  }

  /** 任务数量 */
  total(): number {
    return this._jobs.size;
  }

  /** 获取所有任务（浅拷贝） */
  jobs(): Job[] {
    return [...this._jobs.values()];
  }

  /** 启动调度器 */
  start(): void {
    this.stop();
    this._started = true;

    this._timer = setInterval(() => {
      this._tick();
    }, this.interval);
  }

  /** 停止调度器 */
  stop(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._started = false;
  }

  /** 是否已启动 */
  hasStarted(): boolean {
    return this._started;
  }

  /** 设置检查间隔 */
  setInterval(ms: number): void {
    this.interval = ms;
    if (this._started) {
      this.start(); // 重启
    }
  }

  /** 设置时区 */
  setTimezone(tz: string): void {
    this.timezone = tz;
  }

  /** 内部 tick — 检查所有任务并执行到期的 */
  private _tick(): void {
    const now = new Date();
    const moment = newMoment(now);

    for (const [jobId, schedule] of this._schedules) {
      if (schedule.isDue(moment)) {
        const job = this._jobs.get(jobId);
        if (job) {
          // 每个到期任务在独立异步上下文中执行（对齐 Go 的 goroutine）
          queueMicrotask(() => job.run());
        }
      }
    }
  }
}
