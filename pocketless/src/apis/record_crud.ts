/**
 * Record CRUD 端点
 * 与 Go 版 apis/record_crud.go 对齐
 *
 * GET    /api/collections/:col/records      → 列表（分页）
 * GET    /api/collections/:col/records/:id  → 查看
 * POST   /api/collections/:col/records      → 创建
 * PATCH  /api/collections/:col/records/:id  → 更新
 * DELETE /api/collections/:col/records/:id  → 删除
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import { RecordModel } from "../core/record_model";
import { RecordFieldResolver, type RequestInfo } from "../core/record_field_resolver";
import { notFoundError, forbiddenError, badRequestError } from "./errors";
import { execSearch } from "../tools/search/provider";
import { checkPermissionRule, buildPermissionFilter } from "../core/permission_rule";
import type { CollectionModel } from "../core/collection_model";
import { COLLECTION_TYPE_VIEW } from "../core/collection_model";
import { pick } from "../tools/picker/pick";
import { createFieldFromConfig } from "../core/field";
import "../core/fields_init"; // 导入所有字段类型

/** 从 Hono 上下文提取 RequestInfo（用于权限规则解析） */
function extractRequestInfo(c: any): RequestInfo {
  // TODO: 从 middleware 注入的 auth record 中获取
  const auth = c.get?.("authRecord") ?? null;
  return {
    method: c.req.method,
    headers: Object.fromEntries(c.req.raw.headers?.entries?.() ?? []),
    query: Object.fromEntries(new URL(c.req.url).searchParams.entries()),
    body: {},
    auth,
  };
}

/** Check if the current request has superuser authentication */
function hasSuperuserAuth(c: any): boolean {
  const authRecord = c.get?.("authRecord") ?? c.get?.("auth") ?? null;
  return authRecord != null && typeof authRecord.isSuperuser === "function" && authRecord.isSuperuser();
}

/** 从查询参数提取 fields 并应用 pick 过滤 */
function pickFields(c: any, data: any): any {
  const rawFields = new URL(c.req.url).searchParams.get("fields") ?? "";
  if (!rawFields) return data;
  return pick(data, rawFields);
}

export function registerRecordRoutes(app: Hono, baseApp: BaseApp): void {
  const base = "/api/collections/:collection/records";

  /** 触发 onRecordEnrich hook 并返回 enriched JSON */
  async function enrichRecord(record: RecordModel, col: CollectionModel, c: any): Promise<Record<string, unknown>> {
    const enrichEvent = {
      app: baseApp,
      record,
      collection: col,
      httpContext: c,
      next: async () => {},
    };
    await baseApp.onRecordEnrich().trigger(enrichEvent);
    return record.toJSON();
  }

  // 列表 — 使用 SearchProvider 支持完整 filter/sort 语法
  app.get(base, async (c) => {
    const col = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!col) throw notFoundError();

    // T015: listRule 检查 — superuser bypasses all API rules
    const isSuperuserList = hasSuperuserAuth(c);
    if (col.listRule === null && !isSuperuserList) {
      throw forbiddenError();
    }

    const reqInfo = extractRequestInfo(c);
    const fieldResolver = new RecordFieldResolver(baseApp, col, reqInfo);

    // 如果 listRule 非空，解析为 extraWhere + extraParams 注入到 execSearch
    let extraWhere: string | undefined;
    let extraParams: Record<string, unknown> | undefined;
    if (!isSuperuserList && col.listRule) {
      const permFilter = buildPermissionFilter(baseApp, col, col.listRule, reqInfo);
      if (permFilter) {
        extraWhere = permFilter.where;
        extraParams = permFilter.params;
      }
    }

    const result = execSearch(
      {
        fieldResolver,
        dbAdapter: baseApp.dbAdapter(),
        tableName: col.name,
        defaultSort: "-created",
        extraWhere,
        extraParams,
      },
      {
        page: c.req.query("page"),
        perPage: c.req.query("perPage"),
        sort: c.req.query("sort"),
        filter: c.req.query("filter"),
        skipTotal: c.req.query("skipTotal"),
      },
    );

    const items = result.items.map((row) => {
      const record = new RecordModel(col);
      record.load(row);
      return pickFields(c, record.toJSON());
    });

    return c.json({
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
      items,
    });
  });

  // 查看
  app.get(`${base}/:id`, async (c) => {
    const col = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!col) throw notFoundError();

    // T016: viewRule 检查 — superuser bypasses all API rules
    const isSuperuserView = hasSuperuserAuth(c);
    if (col.viewRule === null && !isSuperuserView) {
      throw forbiddenError();
    }

    const row = baseApp.dbAdapter().queryOne(`SELECT * FROM ${col.name} WHERE id = ?`, c.req.param("id"));
    if (!row) throw notFoundError();

    // 非空 viewRule: 检查记录是否满足规则 (skip for superuser)
    if (col.viewRule && !isSuperuserView) {
      const reqInfo = extractRequestInfo(c);
      try {
        await checkPermissionRule({
          app: baseApp,
          collection: col,
          rule: col.viewRule,
          requestInfo: reqInfo,
          recordId: c.req.param("id"),
        });
      } catch {
        throw forbiddenError();
      }
    }

    const record = new RecordModel(col);
    record.load(row as Record<string, unknown>);
    return c.json(pickFields(c, await enrichRecord(record, col, c)));
  });

  // 创建
  app.post(base, async (c) => {
    const col = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!col) throw notFoundError();

    // T041: View 集合只读
    if (col.type === COLLECTION_TYPE_VIEW) {
      throw badRequestError("View collections are read-only.");
    }

    // T017: createRule 检查 — superuser bypasses all API rules
    const isSuperuserCreate = hasSuperuserAuth(c);
    if (col.createRule === null && !isSuperuserCreate) {
      throw forbiddenError();
    }

    const body = await c.req.json().catch(() => ({}));

    // 非空 createRule: 先用 requestInfo 检查权限 (skip for superuser)
    if (col.createRule && !isSuperuserCreate) {
      const reqInfo = extractRequestInfo(c);
      reqInfo.body = body;
      try {
        await checkPermissionRule({
          app: baseApp,
          collection: col,
          rule: col.createRule,
          requestInfo: reqInfo,
        });
      } catch {
        throw forbiddenError();
      }
    }

    const record = new RecordModel(col);

    if (body.id) {
      record.id = body.id;
    }

    const validationErrors: Record<string, { code: string; message: string }> = {};

    for (const [key, value] of Object.entries(body)) {
      if (key === "id") continue;
      if (key.endsWith("+") || key.startsWith("+") || key.endsWith("-")) {
        record.applyModifier(key, value);
      } else {
        record.set(key, value);
        
        // 字段验证
        const fieldConfig = col.fields.find(f => f.name === key);
        if (fieldConfig) {
          const field = createFieldFromConfig(fieldConfig);
          if (field) {
            const error = field.validateValue(value, record);
            if (error) {
              validationErrors[key] = {
                code: "validation_invalid",
                message: error,
              };
            }
          }
        }
      }
    }

    // 验证必填字段
    for (const fieldConfig of col.fields) {
      if (fieldConfig.required && !record.get(fieldConfig.name) && fieldConfig.name !== "id") {
        validationErrors[fieldConfig.name] = {
          code: "validation_required",
          message: "Cannot be blank.",
        };
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      throw badRequestError(
        "An error occurred while validating the submitted data.",
        validationErrors,
      );
    }

    await baseApp.save(record);

    return c.json(pickFields(c, await enrichRecord(record, col, c)));
  });

  // 更新
  app.patch(`${base}/:id`, async (c) => {
    const col = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!col) throw notFoundError();

    // T041: View 集合只读
    if (col.type === COLLECTION_TYPE_VIEW) {
      throw badRequestError("View collections are read-only.");
    }

    // T018: updateRule 检查 — superuser bypasses all API rules
    const isSuperuserUpdate = hasSuperuserAuth(c);
    if (col.updateRule === null && !isSuperuserUpdate) {
      throw forbiddenError();
    }

    const row = baseApp.dbAdapter().queryOne(`SELECT * FROM ${col.name} WHERE id = ?`, c.req.param("id"));
    if (!row) throw notFoundError();

    if (col.updateRule && !isSuperuserUpdate) {
      const reqInfo = extractRequestInfo(c);
      try {
        await checkPermissionRule({
          app: baseApp,
          collection: col,
          rule: col.updateRule,
          requestInfo: reqInfo,
          recordId: c.req.param("id"),
        });
      } catch {
        throw forbiddenError();
      }
    }

    const record = new RecordModel(col);
    record.load(row as Record<string, unknown>);

    const body = await c.req.json().catch(() => ({}));

    const validationErrors: Record<string, { code: string; message: string }> = {};

    for (const [key, value] of Object.entries(body)) {
      if (key === "id") continue;
      if (key.endsWith("+") || key.startsWith("+") || key.endsWith("-")) {
        record.applyModifier(key, value);
      } else {
        record.set(key, value);
        
        // 字段验证
        const fieldConfig = col.fields.find(f => f.name === key);
        if (fieldConfig) {
          const field = createFieldFromConfig(fieldConfig);
          if (field) {
            const error = field.validateValue(value, record);
            if (error) {
              validationErrors[key] = {
                code: "validation_invalid",
                message: error,
              };
            }
          }
        }
      }
    }

    // 验证必填字段（仅对新值的字段或必填字段检查）
    for (const fieldConfig of col.fields) {
      const currentValue = record.get(fieldConfig.name);
      if (fieldConfig.required && !currentValue && fieldConfig.name !== "id") {
        validationErrors[fieldConfig.name] = {
          code: "validation_required",
          message: "Cannot be blank.",
        };
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      throw badRequestError(
        "An error occurred while validating the submitted data.",
        validationErrors,
      );
    }

    await baseApp.save(record);

    return c.json(pickFields(c, await enrichRecord(record, col, c)));
  });

  // 删除
  app.delete(`${base}/:id`, async (c) => {
    const col = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!col) throw notFoundError();

    // T041: View 集合只读
    if (col.type === COLLECTION_TYPE_VIEW) {
      throw badRequestError("View collections are read-only.");
    }

    // T018: deleteRule 检查 — superuser bypasses all API rules
    const isSuperuserDelete = hasSuperuserAuth(c);
    if (col.deleteRule === null && !isSuperuserDelete) {
      throw forbiddenError();
    }

    const row = baseApp.dbAdapter().queryOne(`SELECT * FROM ${col.name} WHERE id = ?`, c.req.param("id"));
    if (!row) throw notFoundError();

    if (col.deleteRule && !isSuperuserDelete) {
      const reqInfo = extractRequestInfo(c);
      try {
        await checkPermissionRule({
          app: baseApp,
          collection: col,
          rule: col.deleteRule,
          requestInfo: reqInfo,
          recordId: c.req.param("id"),
        });
      } catch {
        throw forbiddenError();
      }
    }

    const record = new RecordModel(col);
    record.load(row as Record<string, unknown>);

    // 特殊规则：_superusers 集合不能删除最后一个 superuser
    if (col.name === "_superusers") {
      const count = baseApp.dbAdapter().queryOne<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM "${col.name}"`,
      );
      if (count && count.cnt === 1) {
        throw badRequestError("You can't delete the only existing superuser.", {});
      }
    }

    await baseApp.delete(record);

    return c.body(null, 204);
  });

  // ─── Hooks for Special Collection Rules ───

  // 创建 _superusers 时强制 verified=true
  baseApp.onRecordCreateExecute("_superusers").bindFunc(async (event) => {
    event.record.set("verified", true);
    await event.next();
  }, -99);

  // 更新 _superusers 时强制 verified=true
  baseApp.onRecordUpdateExecute("_superusers").bindFunc(async (event) => {
    event.record.set("verified", true);
    await event.next();
  }, -99);
}
