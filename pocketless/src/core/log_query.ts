/**
 * log_query.ts — 日志查询辅助
 * 与 Go 版 core/log_query.go, core/log_model.go 对齐
 *
 * _logs 表: id, created, data, message, level
 */

export const LOGS_TABLE_NAME = "_logs";

export interface Log {
  id: string;
  created: string;
  data: Record<string, unknown>;
  message: string;
  level: number;
}

export interface LogsStatsItem {
  date: string;
  total: number;
}

/**
 * LogQueryHelper — 内存实现用于测试
 * 实际生产使用真实 DB 查询
 */
export class LogQueryHelper {
  private logs: Log[] = [];

  addLog(log: Log): void {
    this.logs.push(log);
  }

  findById(id: string): Log | null {
    return this.logs.find((l) => l.id === id) || null;
  }

  list(opts?: {
    page?: number;
    perPage?: number;
    filter?: string;
    sort?: string;
  }): {
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
    items: Log[];
  } {
    const page = Math.max(1, opts?.page ?? 1);
    const perPage = Math.min(100, Math.max(1, opts?.perPage ?? 30));
    let filtered = [...this.logs];

    // 简单 level 过滤支持
    if (opts?.filter) {
      const levelMatch = opts.filter.match(/level\s*[>=<]+\s*(\d+)/);
      if (levelMatch) {
        const op = opts.filter.includes(">=") ? ">=" : opts.filter.includes("<=") ? "<=" : opts.filter.includes(">") ? ">" : opts.filter.includes("<") ? "<" : "=";
        const val = parseInt(levelMatch[1], 10);
        filtered = filtered.filter((l) => {
          switch (op) {
            case ">=": return l.level >= val;
            case "<=": return l.level <= val;
            case ">": return l.level > val;
            case "<": return l.level < val;
            default: return l.level === val;
          }
        });
      }
    }

    // 简单排序
    if (opts?.sort) {
      const desc = opts.sort.startsWith("-");
      const field = desc ? opts.sort.slice(1) : opts.sort;
      filtered.sort((a, b) => {
        const av = (a as Record<string, unknown>)[field];
        const bv = (b as Record<string, unknown>)[field];
        const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
        return desc ? -cmp : cmp;
      });
    }

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / perPage);
    const start = (page - 1) * perPage;
    const items = filtered.slice(start, start + perPage);

    return { page, perPage, totalItems, totalPages, items };
  }

  stats(filter?: string): LogsStatsItem[] {
    let filtered = [...this.logs];

    if (filter) {
      const levelMatch = filter.match(/level\s*>=\s*(\d+)/);
      if (levelMatch) {
        const val = parseInt(levelMatch[1], 10);
        filtered = filtered.filter((l) => l.level >= val);
      }
    }

    // 按小时分组
    const groups = new Map<string, number>();
    for (const log of filtered) {
      const hourKey = log.created.slice(0, 13) + ":00:00";
      groups.set(hourKey, (groups.get(hourKey) || 0) + 1);
    }

    const result: LogsStatsItem[] = [];
    for (const [date, total] of groups) {
      result.push({ date, total });
    }
    result.sort((a, b) => a.date.localeCompare(b.date));
    return result;
  }

  deleteOldLogs(createdBefore: string): number {
    const before = new Date(createdBefore).getTime();
    const initialLen = this.logs.length;
    this.logs = this.logs.filter((l) => new Date(l.created).getTime() > before);
    return initialLen - this.logs.length;
  }
}
