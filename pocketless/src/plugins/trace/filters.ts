/**
 * Trace 插件 — 过滤器系统
 * 对照 Go 版 plugins/trace/filters/
 *
 * 过滤器决定哪些请求应该被追踪。分两个阶段执行：
 * - "pre"  请求处理前（路径过滤、采样、染色用户）
 * - "post" 请求处理后（错误过滤、慢请求过滤）
 */

import type { Filter, FilterContext } from "./register";
import type { DyeStore } from "./dye_store";

// ─────────────────────────────────────────────────────────────────────────────
// ErrorOnly — 只追踪响应状态码 >= 400 的请求
// 对照 Go: filters/error_only.go
// ─────────────────────────────────────────────────────────────────────────────
class ErrorOnlyFilter implements Filter {
  name(): string { return "error_only"; }
  phase(): "pre" | "post" { return "post"; }
  shouldTrace(ctx: FilterContext): boolean {
    if (ctx.statusCode === undefined) return false;
    return ctx.statusCode >= 400;
  }
}

/** 只追踪 HTTP 4xx/5xx 响应 */
export function ErrorOnly(): Filter {
  return new ErrorOnlyFilter();
}

// ─────────────────────────────────────────────────────────────────────────────
// SlowRequest — 只追踪耗时超过阈值的请求
// 对照 Go: filters/slow_request.go
// ─────────────────────────────────────────────────────────────────────────────
class SlowRequestFilter implements Filter {
  constructor(private thresholdMs: number) {}
  name(): string { return "slow_request"; }
  phase(): "pre" | "post" { return "post"; }
  shouldTrace(ctx: FilterContext): boolean {
    if (ctx.durationMs === undefined) return false;
    return ctx.durationMs >= this.thresholdMs;
  }
}

/** 只追踪耗时 >= thresholdMs 毫秒的请求 */
export function SlowRequest(thresholdMs: number): Filter {
  return new SlowRequestFilter(thresholdMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// PathPrefix — 只追踪特定前缀路径
// 对照 Go: filters/path.go PathPrefix()
// ─────────────────────────────────────────────────────────────────────────────
class PathPrefixFilter implements Filter {
  constructor(private prefixes: string[]) {}
  name(): string { return "path_prefix"; }
  phase(): "pre" | "post" { return "pre"; }
  shouldTrace(ctx: FilterContext): boolean {
    return this.prefixes.some((p) => ctx.path.startsWith(p));
  }
}

/** 只追踪路径以任一 prefix 开头的请求 */
export function PathPrefix(...prefixes: string[]): Filter {
  return new PathPrefixFilter(prefixes);
}

// ─────────────────────────────────────────────────────────────────────────────
// PathExclude — 排除特定前缀/包含模式的路径（不追踪）
// 对照 Go: filters/path.go PathExclude()
// ─────────────────────────────────────────────────────────────────────────────
class PathExcludeFilter implements Filter {
  constructor(private patterns: string[]) {}
  name(): string { return "path_exclude"; }
  phase(): "pre" | "post" { return "pre"; }
  shouldTrace(ctx: FilterContext): boolean {
    // 匹配任一 pattern 则排除（返回 false）
    const matched = this.patterns.some(
      (p) => ctx.path.startsWith(p) || ctx.path.includes(p)
    );
    return !matched;
  }
}

/** 排除路径包含任一 pattern 的请求（返回 false = 不追踪） */
export function PathExclude(...patterns: string[]): Filter {
  return new PathExcludeFilter(patterns);
}

// ─────────────────────────────────────────────────────────────────────────────
// SampleRate — 按比例随机采样
// 对照 Go: filters/sample.go
// ─────────────────────────────────────────────────────────────────────────────
class SampleRateFilter implements Filter {
  private readonly rate: number;

  constructor(rate: number) {
    // 规范化到 [0.0, 1.0]
    this.rate = Math.max(0, Math.min(1, rate));
  }

  name(): string { return "sample_rate"; }
  phase(): "pre" | "post" { return "pre"; }

  shouldTrace(_ctx: FilterContext): boolean {
    if (this.rate >= 1.0) return true;
    if (this.rate <= 0.0) return false;
    return Math.random() < this.rate;
  }
}

/** 随机采样，rate 为 [0.0, 1.0]（0 = 不采样, 1 = 全量） */
export function SampleRate(rate: number): Filter {
  return new SampleRateFilter(rate);
}

// ─────────────────────────────────────────────────────────────────────────────
// DyedUser — 染色用户过滤器，优先级最高
// 对照 Go: filters/dyed_user.go
// ─────────────────────────────────────────────────────────────────────────────
class DyedUserFilter implements Filter {
  constructor(private store: DyeStore) {}
  name(): string { return "dyed_user"; }
  phase(): "pre" | "post" { return "pre"; }
  shouldTrace(ctx: FilterContext): boolean {
    if (!ctx.userId) return false;
    return this.store.isDyed(ctx.userId);
  }
}

/** 染色用户过滤器：被染色的用户请求始终追踪 */
export function DyedUserFilter_(store: DyeStore): Filter {
  return new DyedUserFilter(store);
}

// ─────────────────────────────────────────────────────────────────────────────
// 过滤器链执行逻辑
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 对照 Go 中间件逻辑：runFilters
 *
 * conditional 模式：
 *  1. 先跑 "pre" 过滤器，任意一个返回 true → 追踪
 *  2. 再跑 "post" 过滤器，任意一个返回 true → 追踪
 *  3. 全部返回 false → 不追踪
 *
 * full 模式：始终追踪（直接返回 true）
 * off 模式：从不追踪（直接返回 false）
 */
export function shouldTrace(
  mode: "off" | "conditional" | "full",
  filters: Filter[],
  preCtx: FilterContext,
  postCtx?: FilterContext
): boolean {
  if (mode === "off") return false;
  if (mode === "full") return true;

  // conditional 模式
  // Pre 阶段（请求前）
  for (const f of filters) {
    if (f.phase() === "pre" && f.shouldTrace(preCtx)) return true;
  }

  // Post 阶段（请求后，需要 postCtx）
  if (postCtx) {
    for (const f of filters) {
      if (f.phase() === "post" && f.shouldTrace(postCtx)) return true;
    }
  }

  return false;
}
