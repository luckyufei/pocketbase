/**
 * Token 函数 — 与 Go 版 tools/search/token_functions.go 对齐
 *
 * 目前支持:
 *   geoDistance(lonA, latA, lonB, latB) — Haversine 距离（km）
 */

import type { Token } from "./scanner";
import type { ResolverResult } from "./filter_resolver";

/** Token 函数签名 */
export type TokenFunction = (
  resolveToken: (token: Token) => ResolverResult | null,
  ...args: Token[]
) => ResolverResult | null;

/** 全局函数注册表 */
const tokenFunctions = new Map<string, TokenFunction>();

/** 注册 Token 函数 */
export function registerTokenFunction(name: string, fn: TokenFunction): void {
  tokenFunctions.set(name, fn);
}

/** 获取 Token 函数 */
export function getTokenFunction(name: string): TokenFunction | undefined {
  return tokenFunctions.get(name);
}

// ─── 内置函数 ───

/**
 * geoDistance(lonA, latA, lonB, latB)
 *
 * Haversine 公式计算两点之间的距离（km）
 * 参数可以是标识符（字段名）或数值字面量
 *
 * SQLite/PostgreSQL 均使用纯 SQL 表达式实现:
 *   6371 * ACOS(
 *     COS(RADIANS(latA)) * COS(RADIANS(latB)) *
 *     COS(RADIANS(lonB) - RADIANS(lonA)) +
 *     SIN(RADIANS(latA)) * SIN(RADIANS(latB))
 *   )
 */
registerTokenFunction("geoDistance", (resolveToken, ...args) => {
  if (args.length !== 4) {
    return null;
  }

  const resolved = args.map((arg) => resolveToken(arg));
  if (resolved.some((r) => r === null)) return null;

  const [lonA, latA, lonB, latB] = resolved.map((r) => r!.identifier);

  // 合并所有参数的 params
  const params: Record<string, unknown> = {};
  for (const r of resolved) {
    if (r!.params) Object.assign(params, r!.params);
  }

  const sql = [
    "6371 * ACOS(",
    `  COS(RADIANS(${latA})) * COS(RADIANS(${latB})) *`,
    `  COS(RADIANS(${lonB}) - RADIANS(${lonA})) +`,
    `  SIN(RADIANS(${latA})) * SIN(RADIANS(${latB}))`,
    ")",
  ].join("\n");

  return {
    identifier: `(${sql})`,
    noCoalesce: true,
    params: Object.keys(params).length > 0 ? params : undefined,
  };
});
