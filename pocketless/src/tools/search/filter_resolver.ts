/**
 * FilterResolver — AST → SQL WHERE 子句
 * 与 Go 版 tools/search/filter.go 对齐
 *
 * 将 fexpr 解析产出的 ExprGroup[] 转换为参数化 SQL WHERE 子句
 * 支持 SQLite + PostgreSQL 双方言
 */

import type { ExprGroup, Expr } from "./parser";
import { isExpr } from "./parser";
import type { Token, SignOp } from "./scanner";
import { resolveMacro } from "./macros";
import { getTokenFunction } from "./functions";

// ─── 类型定义 ───

/** 字段解析结果 */
export interface ResolverResult {
  /** SQL 列标识符或参数占位符 */
  identifier: string;
  /** 跳过 COALESCE 包装 */
  noCoalesce?: boolean;
  /** 参数绑定 */
  params?: Record<string, unknown>;
  /** 多值匹配子查询 */
  multiMatchSubQuery?: string;
  /** 构建后处理 hook */
  afterBuild?: (expr: string) => string;
}

/** 字段解析器接口 */
export interface FieldResolver {
  /** 解析字段路径为 SQL 列引用 */
  resolve(field: string): ResolverResult | null;
  /** 更新查询（添加 JOIN 等） */
  updateQuery?(query: { joins: string[]; params: Record<string, unknown> }): void;
  /** 数据库类型 */
  dbType?(): "sqlite" | "postgres";
}

/** Filter 构建选项 */
export interface FilterBuildOptions {
  fieldResolver: FieldResolver;
  /** 最大表达式数限制 */
  maxExprLimit?: number;
}

// ─── 参数管理 ───

let paramCounter = 0;

function nextParamName(): string {
  return `__p${++paramCounter}`;
}

/** 重置参数计数器（用于测试） */
export function resetParamCounter(): void {
  paramCounter = 0;
}

// ─── Filter 构建 ───

/**
 * 将 ExprGroup[] 转换为参数化 SQL WHERE 子句
 * @returns [sql, params]
 */
export function buildFilterExpr(
  groups: ExprGroup[],
  options: FilterBuildOptions,
): [string, Record<string, unknown>] {
  const params: Record<string, unknown> = {};
  const limit = { remaining: options.maxExprLimit ?? 200 };
  const sql = buildParsedFilterExpr(groups, options.fieldResolver, params, limit);
  return [sql, params];
}

function buildParsedFilterExpr(
  groups: ExprGroup[],
  resolver: FieldResolver,
  params: Record<string, unknown>,
  limit: { remaining: number },
): string {
  const parts: string[] = [];

  for (const group of groups) {
    let expr: string;

    if (isExpr(group.item)) {
      limit.remaining--;
      if (limit.remaining < 0) {
        throw new Error("max filter expressions limit reached");
      }
      expr = resolveTokenizedExpr(group.item, resolver, params);
    } else {
      // 嵌套 ExprGroup[]
      const nested = buildParsedFilterExpr(group.item, resolver, params, limit);
      if (!nested) continue;
      expr = `(${nested})`;
    }

    if (!expr) continue;

    if (parts.length > 0) {
      const joinOp = group.join === "||" ? "OR" : "AND";
      parts.push(joinOp);
    }
    parts.push(expr);
  }

  return parts.join(" ");
}

// ─── Token 解析 ───

function resolveToken(
  token: Token,
  resolver: FieldResolver,
  params: Record<string, unknown>,
): ResolverResult | null {
  switch (token.type) {
    case "identifier": {
      // 检查宏
      const macroVal = resolveMacro(token.literal);
      if (macroVal !== null) {
        const pName = nextParamName();
        params[pName] = macroVal;
        return { identifier: `:${pName}`, params: { [pName]: macroVal } };
      }

      // 标准化 null/true/false
      const lower = token.literal.toLowerCase();
      const dbType = resolver.dbType?.() ?? "sqlite";
      if (lower === "null") {
        return { identifier: "NULL", noCoalesce: true };
      }
      if (lower === "true") {
        return {
          identifier: dbType === "postgres" ? "TRUE" : "1",
          noCoalesce: true,
        };
      }
      if (lower === "false") {
        return {
          identifier: dbType === "postgres" ? "FALSE" : "0",
          noCoalesce: true,
        };
      }

      // 通过 field resolver 解析
      const result = resolver.resolve(token.literal);
      if (result) return result;

      // 降级到 NULL
      return { identifier: "NULL", noCoalesce: true };
    }

    case "text": {
      const pName = nextParamName();
      params[pName] = token.literal;
      return { identifier: `:${pName}`, params: { [pName]: token.literal } };
    }

    case "number": {
      const num = parseFloat(token.literal);
      const pName = nextParamName();
      params[pName] = num;
      return { identifier: `:${pName}`, params: { [pName]: num } };
    }

    case "function": {
      const fn = getTokenFunction(token.literal);
      if (!fn) return null;

      const tokenResolver = (t: Token) => resolveToken(t, resolver, params);
      return fn(tokenResolver, ...(token.meta ?? []));
    }

    default:
      return null;
  }
}

// ─── 表达式构建 ───

function resolveTokenizedExpr(
  expr: Expr,
  resolver: FieldResolver,
  params: Record<string, unknown>,
): string {
  const left = resolveToken(expr.left, resolver, params);
  const right = resolveToken(expr.right, resolver, params);

  if (!left || !right) {
    return "0 = 1"; // 安全降级
  }

  // 合并参数
  if (left.params) Object.assign(params, left.params);
  if (right.params) Object.assign(params, right.params);

  const op = expr.op;
  const dbType = resolver.dbType?.() ?? "sqlite";
  const isAnyOp = op.startsWith("?");

  // 多值匹配处理
  if (!isAnyOp && (left.multiMatchSubQuery || right.multiMatchSubQuery)) {
    return buildMultiMatchExpr(left, right, op, dbType, params);
  }

  let result = buildResolversExpr(left, right, op, dbType, params);

  // afterBuild hook
  if (left.afterBuild) result = left.afterBuild(result);
  if (right.afterBuild) result = right.afterBuild(result);

  return result;
}

function buildResolversExpr(
  left: ResolverResult,
  right: ResolverResult,
  op: SignOp,
  dbType: "sqlite" | "postgres",
  params: Record<string, unknown>,
): string {
  const baseOp = op.startsWith("?") ? op.slice(1) : op;

  switch (baseOp) {
    case "=":
      return resolveEqualExpr(left, right, false, dbType, params);

    case "!=":
      return resolveEqualExpr(left, right, true, dbType, params);

    case "~":
      return resolveLikeExpr(left, right, false, params);

    case "!~":
      return resolveLikeExpr(left, right, true, params);

    case "<":
      return `${left.identifier} < ${right.identifier}`;

    case "<=":
      return `${left.identifier} <= ${right.identifier}`;

    case ">":
      return `${left.identifier} > ${right.identifier}`;

    case ">=":
      return `${left.identifier} >= ${right.identifier}`;

    default:
      return "0 = 1";
  }
}

/**
 * 相等表达式 — 智能 NULL/空值处理
 * 与 Go 版 resolveEqualExpr() 对齐
 */
function resolveEqualExpr(
  left: ResolverResult,
  right: ResolverResult,
  negate: boolean,
  dbType: "sqlite" | "postgres",
  params: Record<string, unknown>,
): string {
  // 如果 NoCoalesce，使用直接比较
  if (left.noCoalesce || right.noCoalesce) {
    if (negate) {
      if (dbType === "postgres") {
        return `${left.identifier} IS DISTINCT FROM ${right.identifier}`;
      }
      return `${left.identifier} IS NOT ${right.identifier}`;
    }
    if (dbType === "postgres") {
      return `${left.identifier} IS NOT DISTINCT FROM ${right.identifier}`;
    }
    return `${left.identifier} IS ${right.identifier}`;
  }

  // 检测是否为空值参数
  const leftEmpty = isEmptyParam(left, params);
  const rightEmpty = isEmptyParam(right, params);

  if (leftEmpty && rightEmpty) {
    return negate ? "'' != ''" : "'' = ''";
  }

  if (leftEmpty) {
    if (negate) {
      return `(${right.identifier} IS NOT '' AND ${right.identifier} IS NOT NULL)`;
    }
    return `(${right.identifier} = '' OR ${right.identifier} IS NULL)`;
  }

  if (rightEmpty) {
    if (negate) {
      return `(${left.identifier} IS NOT '' AND ${left.identifier} IS NOT NULL)`;
    }
    return `(${left.identifier} = '' OR ${left.identifier} IS NULL)`;
  }

  // 通用情况 — COALESCE
  if (negate) {
    return `COALESCE(${left.identifier}, '') != COALESCE(${right.identifier}, '')`;
  }
  return `COALESCE(${left.identifier}, '') = COALESCE(${right.identifier}, '')`;
}

function isEmptyParam(result: ResolverResult, params: Record<string, unknown>): boolean {
  if (!result.identifier.startsWith(":")) return false;
  const paramName = result.identifier.slice(1);
  const value = params[paramName];
  return value === "" || value === null || value === undefined;
}

/**
 * LIKE 表达式 — 自动添加 % 通配符
 */
function resolveLikeExpr(
  left: ResolverResult,
  right: ResolverResult,
  negate: boolean,
  params: Record<string, unknown>,
): string {
  // 将右侧参数包装为 %value%
  let rightIdentifier = right.identifier;
  if (rightIdentifier.startsWith(":")) {
    const paramName = rightIdentifier.slice(1);
    const value = params[paramName];
    if (typeof value === "string") {
      // 转义 LIKE 通配符和反斜杠
      const escaped = value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
      params[paramName] = `%${escaped}%`;
    } else if (typeof value === "number") {
      params[paramName] = `%${value}%`;
    }
  }

  const op = negate ? "NOT LIKE" : "LIKE";
  return `${left.identifier} ${op} ${rightIdentifier} ESCAPE '\\'`;
}

/**
 * 多值匹配子查询表达式
 */
function buildMultiMatchExpr(
  left: ResolverResult,
  right: ResolverResult,
  op: SignOp,
  dbType: "sqlite" | "postgres",
  params: Record<string, unknown>,
): string {
  // 简化处理 — 使用标准比较操作
  // 完整的多值匹配需要 json_each/jsonb_array_elements 子查询
  // 这里先使用直接比较作为基础实现
  return buildResolversExpr(left, right, op, dbType, params);
}

// ─── 简单字段解析器 ───

/**
 * SimpleFieldResolver — 与 Go 版 tools/search/simple_field_resolver.go 对齐
 *
 * 根据允许的字段列表（支持正则）解析字段路径
 */
export class SimpleFieldResolver implements FieldResolver {
  private allowedFields: (string | RegExp)[];
  private _dbType: "sqlite" | "postgres";

  constructor(allowedFields: (string | RegExp)[], dbType: "sqlite" | "postgres" = "sqlite") {
    this.allowedFields = allowedFields;
    this._dbType = dbType;
  }

  dbType(): "sqlite" | "postgres" {
    return this._dbType;
  }

  resolve(field: string): ResolverResult | null {
    // 检查是否在允许列表中
    const allowed = this.allowedFields.some((pattern) => {
      if (typeof pattern === "string") return pattern === field;
      return pattern.test(field);
    });

    if (!allowed) return null;

    // 处理带点的路径（JSON 字段）
    const dotIdx = field.indexOf(".");
    if (dotIdx > 0) {
      const column = field.slice(0, dotIdx);
      const jsonPath = field.slice(dotIdx + 1);
      if (this._dbType === "postgres") {
        return { identifier: `[[${column}]]->>'${jsonPath}'` };
      }
      return { identifier: `JSON_EXTRACT([[${column}]], '$.${jsonPath}')` };
    }

    return { identifier: `[[${field}]]` };
  }
}

// ─── 排序解析 ───

export interface SortField {
  column: string;
  direction: "ASC" | "DESC";
}

/**
 * 解析排序字符串
 * 格式: "-created,title,+updated"
 *   - 前缀 → DESC
 *   + 前缀（或无前缀）→ ASC
 *   @random → RANDOM()
 */
export function parseSortFromString(raw: string): SortField[] {
  if (!raw.trim()) return [];

  return raw.split(",").map((s) => {
    s = s.trim();
    if (s.startsWith("-")) {
      return { column: s.slice(1), direction: "DESC" as const };
    }
    if (s.startsWith("+")) {
      return { column: s.slice(1), direction: "ASC" as const };
    }
    return { column: s, direction: "ASC" as const };
  });
}

/**
 * 构建排序 SQL 表达式
 */
export function buildSortExpr(
  fields: SortField[],
  resolver: FieldResolver,
): string {
  const parts: string[] = [];

  for (const field of fields) {
    // 特殊排序键
    if (field.column === "@random") {
      parts.push(`RANDOM() ${field.direction}`);
      continue;
    }

    if (field.column === "@rowid") {
      const dbType = resolver.dbType?.() ?? "sqlite";
      const col = dbType === "postgres" ? "[[id]]" : "[[_rowid_]]";
      parts.push(`${col} ${field.direction}`);
      continue;
    }

    const result = resolver.resolve(field.column);
    if (result && result.identifier) {
      parts.push(`${result.identifier} ${field.direction}`);
    }
  }

  return parts.join(", ");
}
