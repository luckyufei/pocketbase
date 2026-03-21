/**
 * 日期宏 — 与 Go 版 tools/search/identifier_macros.go 对齐
 *
 * 16 个时间宏：@now, @yesterday, @tomorrow, @second, @minute, @hour,
 * @day, @month, @weekday, @year, @todayStart, @todayEnd,
 * @monthStart, @monthEnd, @yearStart, @yearEnd
 */

/** 格式化 UTC 日期为 PocketBase DateTime 格式 */
function formatDateTime(d: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}Z`;
}

/** 宏返回值可以是字符串或数字 */
export type MacroValue = string | number;

/**
 * 获取宏值
 * @returns null 表示不是已知宏
 */
export function resolveMacro(name: string): MacroValue | null {
  const now = new Date();

  switch (name) {
    case "@now":
      return formatDateTime(now);

    case "@yesterday": {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - 1);
      return formatDateTime(d);
    }

    case "@tomorrow": {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() + 1);
      return formatDateTime(d);
    }

    case "@second":
      return now.getUTCSeconds();

    case "@minute":
      return now.getUTCMinutes();

    case "@hour":
      return now.getUTCHours();

    case "@day":
      return now.getUTCDate();

    case "@month":
      return now.getUTCMonth() + 1;

    case "@weekday":
      return now.getUTCDay();

    case "@year":
      return now.getUTCFullYear();

    case "@todayStart": {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      return formatDateTime(d);
    }

    case "@todayEnd": {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      return formatDateTime(d);
    }

    case "@monthStart": {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      return formatDateTime(d);
    }

    case "@monthEnd": {
      // 下月第 0 天 = 本月最后一天
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      return formatDateTime(d);
    }

    case "@yearStart": {
      const d = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
      return formatDateTime(d);
    }

    case "@yearEnd": {
      const d = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
      return formatDateTime(d);
    }

    default:
      return null;
  }
}

/** 所有已知宏名称 */
export const knownMacros = [
  "@now",
  "@yesterday",
  "@tomorrow",
  "@second",
  "@minute",
  "@hour",
  "@day",
  "@month",
  "@weekday",
  "@year",
  "@todayStart",
  "@todayEnd",
  "@monthStart",
  "@monthEnd",
  "@yearStart",
  "@yearEnd",
] as const;
