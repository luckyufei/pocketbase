/**
 * RecordFieldResolver — 记录字段路径 → SQL 列引用
 * 与 Go 版 core/record_field_resolver.go 对齐
 *
 * 支持:
 * - 普通字段: title, created, etc.
 * - 关系字段: author.name (自动 JOIN)
 * - 反向关系: posts_via_author
 * - @request.auth.* — 当前认证用户字段
 * - @request.body.* — 请求体字段
 * - @request.query.* — 查询参数
 * - @request.headers.* — 请求头
 * - @request.context — 请求上下文
 * - @request.method — HTTP 方法
 * - @collection.name.field — 跨集合引用
 * - 修饰符: :isset, :changed, :length, :each, :lower
 */

import type { FieldResolver, ResolverResult } from "../tools/search/filter_resolver";
import { extractModifiers, applyLengthModifier, applyLowerModifier } from "../tools/search/modifiers";
import type { BaseApp } from "./base";
import type { CollectionModel } from "./collection_model";
import type { RecordModel } from "./record_model";

/** 最大嵌套关系深度 */
const MAX_NESTED_DEPTH = 6;

/** 允许的字段路径模式 */
const allowedPatterns = [
  /^\w+[\w.:]*$/,
  /^@request\.context$/,
  /^@request\.method$/,
  /^@request\.auth\.[\w.:]*\w+$/,
  /^@request\.body\.[\w.:]*\w+$/,
  /^@request\.query\.[\w.:]*\w+$/,
  /^@request\.headers\.[\w.:]*\w+$/,
  /^@collection\.\w+(:\w+)?\.[\w.:]*\w+$/,
];

export interface RequestInfo {
  method?: string;
  context?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  auth?: RecordModel | null;
}

export class RecordFieldResolver implements FieldResolver {
  private app: BaseApp;
  private collection: CollectionModel;
  private requestInfo: RequestInfo;
  private _dbType: "sqlite" | "postgres";
  private joins: Map<string, string> = new Map();
  private joinParams: Record<string, unknown> = {};
  private allowHiddenFields: boolean;

  constructor(
    app: BaseApp,
    collection: CollectionModel,
    requestInfo: RequestInfo = {},
    allowHiddenFields = false,
  ) {
    this.app = app;
    this.collection = collection;
    this.requestInfo = requestInfo;
    this._dbType = app.dbAdapter().type();
    this.allowHiddenFields = allowHiddenFields;
  }

  dbType(): "sqlite" | "postgres" {
    return this._dbType;
  }

  /** 获取累积的 JOIN 子句 */
  getJoins(): string[] {
    return [...this.joins.values()];
  }

  /** 获取累积的 JOIN 参数 */
  getJoinParams(): Record<string, unknown> {
    return { ...this.joinParams };
  }

  /** 更新查询（添加 JOIN） */
  updateQuery(query: { joins: string[]; params: Record<string, unknown> }): void {
    query.joins.push(...this.getJoins());
    Object.assign(query.params, this.getJoinParams());
  }

  resolve(field: string): ResolverResult | null {
    // 验证字段路径格式
    const isAllowed = allowedPatterns.some((p) => p.test(field));
    if (!isAllowed) return null;

    // 提取修饰符
    const [cleanPath, modifiers] = extractModifiers(field);

    // @request.* 特殊处理
    if (cleanPath.startsWith("@request.")) {
      return this.resolveRequestField(cleanPath, modifiers);
    }

    // @collection.* 跨集合引用
    if (cleanPath.startsWith("@collection.")) {
      return this.resolveCollectionField(cleanPath, modifiers);
    }

    // 普通字段
    return this.resolveRecordField(cleanPath, modifiers, this.collection, this.collection.name, 0);
  }

  // ─── @request.* 解析 ───

  private resolveRequestField(path: string, modifiers: string[]): ResolverResult | null {
    const rest = path.slice("@request.".length);

    if (rest === "context") {
      if (modifiers.includes("isset")) {
        return { identifier: this.requestInfo.context !== undefined ? "TRUE" : "FALSE", noCoalesce: true };
      }
      return this.staticResult(this.requestInfo.context ?? "default");
    }

    if (rest === "method") {
      if (modifiers.includes("isset")) {
        return { identifier: this.requestInfo.method !== undefined ? "TRUE" : "FALSE", noCoalesce: true };
      }
      return this.staticResult(this.requestInfo.method ?? "GET");
    }

    if (rest.startsWith("query.")) {
      const key = rest.slice("query.".length);
      if (modifiers.includes("isset")) {
        const exists = this.requestInfo.query !== undefined && key in (this.requestInfo.query ?? {});
        return { identifier: exists ? "TRUE" : "FALSE", noCoalesce: true };
      }
      return this.staticResult(this.requestInfo.query?.[key] ?? "");
    }

    if (rest.startsWith("headers.")) {
      const key = rest.slice("headers.".length).toLowerCase();
      if (modifiers.includes("isset")) {
        const exists = this.requestInfo.headers !== undefined && key in (this.requestInfo.headers ?? {});
        return { identifier: exists ? "TRUE" : "FALSE", noCoalesce: true };
      }
      return this.staticResult(this.requestInfo.headers?.[key] ?? "");
    }

    if (rest.startsWith("body.")) {
      const key = rest.slice("body.".length);
      if (modifiers.includes("isset")) {
        const exists = this.requestInfo.body !== undefined && key in (this.requestInfo.body ?? {});
        return { identifier: exists ? "TRUE" : "FALSE", noCoalesce: true };
      }
      if (modifiers.includes("changed")) {
        // 对齐 Go: 展开为 "@request.body.{name}:isset = true && @request.body.{name} != {name}"
        const exists = this.requestInfo.body !== undefined && key in (this.requestInfo.body ?? {});
        if (!exists) {
          return { identifier: "FALSE", noCoalesce: true };
        }
        // 生成占位符 + afterBuild 替换
        const placeholder = `@changed@${key}`;
        return {
          identifier: placeholder,
          noCoalesce: true,
          afterBuild: (expr: string) => {
            // 替换占位符为实际子表达式
            const bodyVal = this.requestInfo.body?.[key];
            const pName = `__changed_${key}`;
            // TRUE AND @request.body.{key} != {key}
            // 简化: 直接比较值与列
            return expr.replace(placeholder, `(TRUE AND ${this.staticResult(bodyVal ?? "").identifier} != [[${this.collection.name}]].[[${key}]])`);
          },
        };
      }
      const value = this.requestInfo.body?.[key];
      return this.staticResult(value ?? "");
    }

    if (rest.startsWith("auth.")) {
      const authField = rest.slice("auth.".length);
      if (modifiers.includes("isset")) {
        const auth = this.requestInfo.auth;
        if (!auth) return { identifier: "FALSE", noCoalesce: true };
        const value = auth.get(authField);
        return { identifier: value !== undefined ? "TRUE" : "FALSE", noCoalesce: true };
      }
      const auth = this.requestInfo.auth;
      if (!auth) {
        return { identifier: "NULL" };
      }
      const value = auth.get(authField);
      return this.staticResult(value ?? "");
    }

    return null;
  }

  // ─── @collection.* 解析 ───

  private resolveCollectionField(path: string, modifiers: string[]): ResolverResult | null {
    // @collection.collectionName.fieldPath
    const rest = path.slice("@collection.".length);
    const dotIdx = rest.indexOf(".");
    if (dotIdx < 0) return null;

    const colNameOrAlias = rest.slice(0, dotIdx);
    const fieldPath = rest.slice(dotIdx + 1);

    // 分离 collection 名和可选的别名
    const colonIdx = colNameOrAlias.indexOf(":");
    const colName = colonIdx >= 0 ? colNameOrAlias.slice(0, colonIdx) : colNameOrAlias;
    const alias = colonIdx >= 0 ? colNameOrAlias.slice(colonIdx + 1) : colName;

    // 查找集合
    // 注意: findCollectionByNameOrId 是 async，这里需要同步访问
    // 简化处理：直接使用表名引用
    const tableAlias = `__cross_${alias}`;

    // 添加 JOIN
    if (!this.joins.has(tableAlias)) {
      this.joins.set(tableAlias, `LEFT JOIN [[${colName}]] AS [[${tableAlias}]] ON 1=1`);
    }

    return this.resolveFieldPath(fieldPath, modifiers, tableAlias);
  }

  // ─── 普通字段解析 ───

  private resolveRecordField(
    path: string,
    modifiers: string[],
    collection: CollectionModel,
    tableAlias: string,
    depth: number,
  ): ResolverResult | null {
    if (depth > MAX_NESTED_DEPTH) return null;

    // 处理点号分隔的路径
    const dotIdx = path.indexOf(".");
    if (dotIdx < 0) {
      // 叶子字段
      return this.resolveFieldPath(path, modifiers, tableAlias);
    }

    const firstPart = path.slice(0, dotIdx);
    const remainingPath = path.slice(dotIdx + 1);

    // 检查是否为反向关系 (collectionName_via_fieldName)
    const backRelMatch = firstPart.match(/^(\w+)_via_(\w+)$/);
    if (backRelMatch) {
      return this.resolveBackRelation(
        backRelMatch[1],
        backRelMatch[2],
        remainingPath,
        modifiers,
        tableAlias,
        depth,
      );
    }

    // 检查该字段是否为关系字段
    const field = collection.getFieldByName(firstPart);
    if (field && field.type === "relation") {
      return this.resolveRelation(field, collection, remainingPath, modifiers, tableAlias, depth);
    }

    // JSON 字段
    if (field && (field.type === "json" || field.type === "geoPoint")) {
      if (this._dbType === "postgres") {
        return { identifier: `[[${tableAlias}]].[[${firstPart}]]->>'${remainingPath}'` };
      }
      return { identifier: `JSON_EXTRACT([[${tableAlias}]].[[${firstPart}]], '$.${remainingPath}')` };
    }

    return null;
  }

  // ─── 关系解析 ───

  private resolveRelation(
    field: { id: string; name: string; type: string; options: Record<string, unknown> },
    collection: CollectionModel,
    remainingPath: string,
    modifiers: string[],
    tableAlias: string,
    depth: number,
  ): ResolverResult | null {
    // 如果剩余路径只是 "id"，直接使用当前字段值（避免不必要的 JOIN）
    if (remainingPath === "id") {
      return this.resolveFieldPath(field.name, modifiers, tableAlias);
    }

    const relCollectionId = field.options.collectionId as string;
    if (!relCollectionId) return null;

    // 生成 JOIN 别名
    const joinAlias = `__rel_${field.name}_${depth}`;

    if (!this.joins.has(joinAlias)) {
      const isMultiple = (field.options.maxSelect as number) !== 1;

      if (isMultiple) {
        // 多值关系 — 通过 json_each
        if (this._dbType === "postgres") {
          this.joins.set(
            joinAlias,
            `LEFT JOIN [[${relCollectionId}]] AS [[${joinAlias}]] ` +
              `ON [[${joinAlias}]].[[id]] IN (SELECT value::text FROM jsonb_array_elements_text([[${tableAlias}]].[[${field.name}]]))`,
          );
        } else {
          this.joins.set(
            joinAlias,
            `LEFT JOIN [[${relCollectionId}]] AS [[${joinAlias}]] ` +
              `ON [[${joinAlias}]].[[id]] IN (SELECT value FROM json_each([[${tableAlias}]].[[${field.name}]]))`,
          );
        }
      } else {
        // 单值关系 — 直接 JOIN
        this.joins.set(
          joinAlias,
          `LEFT JOIN [[${relCollectionId}]] AS [[${joinAlias}]] ` +
            `ON [[${joinAlias}]].[[id]] = [[${tableAlias}]].[[${field.name}]]`,
        );
      }
    }

    // 递归解析剩余路径
    // 注意: 此处简化处理，实际需要加载目标集合的字段定义
    return this.resolveFieldPath(remainingPath, modifiers, joinAlias);
  }

  // ─── 反向关系 ───

  private resolveBackRelation(
    colName: string,
    fieldName: string,
    remainingPath: string,
    modifiers: string[],
    tableAlias: string,
    depth: number,
  ): ResolverResult | null {
    const joinAlias = `__back_${colName}_${fieldName}_${depth}`;

    if (!this.joins.has(joinAlias)) {
      // 反向关系 JOIN
      if (this._dbType === "postgres") {
        this.joins.set(
          joinAlias,
          `LEFT JOIN [[${colName}]] AS [[${joinAlias}]] ` +
            `ON [[${tableAlias}]].[[id]] IN (SELECT value::text FROM jsonb_array_elements_text([[${joinAlias}]].[[${fieldName}]])) ` +
            `OR [[${tableAlias}]].[[id]] = [[${joinAlias}]].[[${fieldName}]]`,
        );
      } else {
        this.joins.set(
          joinAlias,
          `LEFT JOIN [[${colName}]] AS [[${joinAlias}]] ` +
            `ON [[${tableAlias}]].[[id]] IN (SELECT value FROM json_each([[${joinAlias}]].[[${fieldName}]])) ` +
            `OR [[${tableAlias}]].[[id]] = [[${joinAlias}]].[[${fieldName}]]`,
        );
      }
    }

    return this.resolveFieldPath(remainingPath, modifiers, joinAlias);
  }

  // ─── 辅助方法 ───

  private resolveFieldPath(
    fieldName: string,
    modifiers: string[],
    tableAlias: string,
  ): ResolverResult | null {
    // 处理带点的路径（JSON 子字段）
    const dotIdx = fieldName.indexOf(".");
    let identifier: string;

    if (dotIdx > 0) {
      const column = fieldName.slice(0, dotIdx);
      const jsonPath = fieldName.slice(dotIdx + 1);
      if (this._dbType === "postgres") {
        identifier = `[[${tableAlias}]].[[${column}]]->>'${jsonPath}'`;
      } else {
        identifier = `JSON_EXTRACT([[${tableAlias}]].[[${column}]], '$.${jsonPath}')`;
      }
    } else {
      identifier = `[[${tableAlias}]].[[${fieldName}]]`;
    }

    // 应用修饰符
    for (const mod of modifiers) {
      switch (mod) {
        case "length":
          identifier = applyLengthModifier(identifier, this._dbType);
          break;
        case "lower":
          identifier = applyLowerModifier(identifier);
          break;
        case "isset":
          return {
            identifier: `(${identifier} IS NOT NULL AND ${identifier} != '')`,
            noCoalesce: true,
          };
        case "changed":
          // :changed 需要请求上下文中的原始值
          // 简化实现：始终返回 true
          return { identifier: "1", noCoalesce: true };
        case "each":
          // :each 需要 json_each/jsonb_array_elements JOIN
          return this.resolveEachModifier(identifier, tableAlias, fieldName);
      }
    }

    return { identifier };
  }

  private resolveEachModifier(
    identifier: string,
    tableAlias: string,
    fieldName: string,
  ): ResolverResult | null {
    const eachAlias = `__each_${tableAlias}_${fieldName}`;

    if (!this.joins.has(eachAlias)) {
      if (this._dbType === "postgres") {
        this.joins.set(
          eachAlias,
          `LEFT JOIN jsonb_array_elements_text(${identifier}) AS [[${eachAlias}]](value) ON TRUE`,
        );
      } else {
        this.joins.set(
          eachAlias,
          `LEFT JOIN json_each(${identifier}) AS [[${eachAlias}]]`,
        );
      }
    }

    return { identifier: `[[${eachAlias}]].value` };
  }

  private staticResult(value: unknown): ResolverResult {
    const pName = `__req_${Object.keys(this.joinParams).length}`;
    this.joinParams[pName] = value;
    return {
      identifier: `:${pName}`,
      params: { [pName]: value },
    };
  }
}
