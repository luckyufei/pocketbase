/**
 * CRUD + Hook 链 — Save(), Delete(), Validate()
 * 与 Go 版 core/db.go 对齐
 * 实现嵌套 Hook 触发模式：onModelCreate → validate → onModelCreateExecute → DB write → onModelAfterCreateSuccess
 * 失败时触发 onModelAfterCreateError（对齐 Go 版 error hook）
 */

import type { BaseApp } from "./base";
import type { BaseModel } from "./base_model";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";
import type { ModelEvent, ModelErrorEvent, RecordEvent, CollectionEvent } from "./events";

/**
 * 执行 Save — 根据 model.isNew() 分派到 create 或 update
 */
export async function modelSave(app: BaseApp, model: BaseModel): Promise<void> {
  if (model.isNew()) {
    await modelCreate(app, model);
  } else {
    await modelUpdate(app, model);
  }
}

/**
 * 创建模型 — 嵌套 Hook 链（对齐 Go 版 core/db.go create()）
 * onModelCreate → validate → onModelCreateExecute → DB write
 *   成功 → onModelAfterCreateSuccess + Record/Collection 二级 hook
 *   失败 → onModelAfterCreateError（重置 new 状态）
 */
async function modelCreate(app: BaseApp, model: BaseModel): Promise<void> {
  const event: ModelEvent = {
    app,
    model,
    next: async () => {},
  };

  // Record-level 前置 hook（T005）
  if (isRecord(model)) {
    const record = model as RecordModel;
    const col = record.collection();
    await app.onRecordCreate(col.name, col.id).trigger({
      app,
      record,
      collection: col,
      next: async () => {},
    });
  }

  let saveErr: Error | null = null;

  try {
    await app.onModelCreate().trigger({
      ...event,
      next: async () => {
        await modelValidate(app, model);

        // Record-level Execute hook
        if (isRecord(model)) {
          const record = model as RecordModel;
          const col = record.collection();
          await app.onRecordCreateExecute(col.name, col.id).trigger({
            app,
            record,
            collection: col,
            next: async () => {},
          });
        }

        await app.onModelCreateExecute().trigger({
          ...event,
          next: async () => {
            model.refreshTimestamps();
            const row = (model as any).toDBRow ? (model as any).toDBRow() : model.toJSON();
            const table = model.tableName();
            const keys = Object.keys(row);
            const placeholders = keys.map(() => "?").join(", ");
            const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`;
            app.dbAdapter().exec(sql, ...keys.map((k) => row[k]));
            model.markAsNotNew();
          },
        });
      },
    });
  } catch (err) {
    saveErr = err instanceof Error ? err : new Error(String(err));
  }

  if (saveErr) {
    model.markAsNew();
    const errEvent: ModelErrorEvent = { ...event, error: saveErr, next: async () => {} };
    try {
      await app.onModelAfterCreateError().trigger(errEvent);
    } catch (hookErr) {
      // 合并原始错误和 hook 错误（对齐 Go errors.Join）
      const combined = new Error(`${saveErr.message}; ${hookErr instanceof Error ? hookErr.message : String(hookErr)}`);
      throw combined;
    }
    throw saveErr;
  }

  await app.onModelAfterCreateSuccess().trigger({
    ...event,
    next: async () => {},
  });

  if (isRecord(model)) {
    await triggerRecordCreateHooks(app, model as RecordModel);
  } else if (isCollection(model)) {
    await triggerCollectionCreateHooks(app, model as unknown as CollectionModel);
  }
}

/**
 * 更新模型（对齐 Go 版 core/db.go update()）
 */
async function modelUpdate(app: BaseApp, model: BaseModel): Promise<void> {
  const event: ModelEvent = {
    app,
    model,
    next: async () => {},
  };

  // Record-level 前置 hook（T005）
  if (isRecord(model)) {
    const record = model as RecordModel;
    const col = record.collection();
    await app.onRecordUpdate(col.name, col.id).trigger({
      app,
      record,
      collection: col,
      next: async () => {},
    });
  }

  let saveErr: Error | null = null;

  try {
    await app.onModelUpdate().trigger({
      ...event,
      next: async () => {
        await modelValidate(app, model);

        // Record-level Execute hook
        if (isRecord(model)) {
          const record = model as RecordModel;
          const col = record.collection();
          await app.onRecordUpdateExecute(col.name, col.id).trigger({
            app,
            record,
            collection: col,
            next: async () => {},
          });
        }

        await app.onModelUpdateExecute().trigger({
          ...event,
          next: async () => {
            model.refreshTimestamps();
            const row = (model as any).toDBRow ? (model as any).toDBRow() : model.toJSON();
            const table = model.tableName();
            const keys = Object.keys(row).filter((k) => k !== "id");
            const sets = keys.map((k) => `${k} = ?`).join(", ");
            const sql = `UPDATE ${table} SET ${sets} WHERE id = ?`;
            app.dbAdapter().exec(sql, ...keys.map((k) => row[k]), model.id);
          },
        });
      },
    });
  } catch (err) {
    saveErr = err instanceof Error ? err : new Error(String(err));
  }

  if (saveErr) {
    const errEvent: ModelErrorEvent = { ...event, error: saveErr, next: async () => {} };
    try {
      await app.onModelAfterUpdateError().trigger(errEvent);
    } catch (hookErr) {
      const combined = new Error(`${saveErr.message}; ${hookErr instanceof Error ? hookErr.message : String(hookErr)}`);
      throw combined;
    }
    throw saveErr;
  }

  await app.onModelAfterUpdateSuccess().trigger({
    ...event,
    next: async () => {},
  });

  if (isRecord(model)) {
    await triggerRecordUpdateHooks(app, model as RecordModel);
  } else if (isCollection(model)) {
    await triggerCollectionUpdateHooks(app, model as unknown as CollectionModel);
  }
}

/**
 * 删除模型（对齐 Go 版 core/db.go delete()）
 */
export async function modelDelete(app: BaseApp, model: BaseModel): Promise<void> {
  const event: ModelEvent = {
    app,
    model,
    next: async () => {},
  };

  // Record-level 前置 hook（T005）
  if (isRecord(model)) {
    const record = model as RecordModel;
    const col = record.collection();
    await app.onRecordDelete(col.name, col.id).trigger({
      app,
      record,
      collection: col,
      next: async () => {},
    });
  }

  let deleteErr: Error | null = null;

  try {
    await app.onModelDelete().trigger({
      ...event,
      next: async () => {
        // Record-level Execute hook
        if (isRecord(model)) {
          const record = model as RecordModel;
          const col = record.collection();
          await app.onRecordDeleteExecute(col.name, col.id).trigger({
            app,
            record,
            collection: col,
            next: async () => {},
          });
        }

        await app.onModelDeleteExecute().trigger({
          ...event,
          next: async () => {
            const table = model.tableName();
            app.dbAdapter().exec(`DELETE FROM ${table} WHERE id = ?`, model.id);
          },
        });
      },
    });
  } catch (err) {
    deleteErr = err instanceof Error ? err : new Error(String(err));
  }

  if (deleteErr) {
    const errEvent: ModelErrorEvent = { ...event, error: deleteErr, next: async () => {} };
    try {
      await app.onModelAfterDeleteError().trigger(errEvent);
    } catch (hookErr) {
      const combined = new Error(`${deleteErr.message}; ${hookErr instanceof Error ? hookErr.message : String(hookErr)}`);
      throw combined;
    }
    throw deleteErr;
  }

  await app.onModelAfterDeleteSuccess().trigger({
    ...event,
    next: async () => {},
  });

  if (isRecord(model)) {
    await triggerRecordDeleteHooks(app, model as RecordModel);
  } else if (isCollection(model)) {
    await triggerCollectionDeleteHooks(app, model as unknown as CollectionModel);
  }
}

/**
 * 验证模型
 */
export async function modelValidate(app: BaseApp, model: BaseModel): Promise<void> {
  const event: ModelEvent = {
    app,
    model,
    next: async () => {},
  };

  await app.onModelValidate().trigger({
    ...event,
    next: async () => {
      if (!model.id) {
        throw new Error("model ID is required");
      }
    },
  });

  if (isRecord(model)) {
    const record = model as RecordModel;
    const col = record.collection();
    await app.onRecordValidate(col.name, col.id).trigger({
      app,
      record,
      collection: col,
      next: async () => {},
    });
  }
}

// ─── Record Hook 触发器 ───

async function triggerRecordCreateHooks(app: BaseApp, record: RecordModel): Promise<void> {
  const col = record.collection();
  const event: RecordEvent = {
    app,
    record,
    collection: col,
    next: async () => {},
  };
  await app.onRecordAfterCreateSuccess(col.name, col.id).trigger(event);
}

async function triggerRecordUpdateHooks(app: BaseApp, record: RecordModel): Promise<void> {
  const col = record.collection();
  const event: RecordEvent = {
    app,
    record,
    collection: col,
    next: async () => {},
  };
  await app.onRecordAfterUpdateSuccess(col.name, col.id).trigger(event);
}

async function triggerRecordDeleteHooks(app: BaseApp, record: RecordModel): Promise<void> {
  const col = record.collection();
  const event: RecordEvent = {
    app,
    record,
    collection: col,
    next: async () => {},
  };
  await app.onRecordAfterDeleteSuccess(col.name, col.id).trigger(event);
}

// ─── Collection Hook 触发器 ───

async function triggerCollectionCreateHooks(app: BaseApp, collection: CollectionModel): Promise<void> {
  const event: CollectionEvent = {
    app,
    collection,
    next: async () => {},
  };
  await app.onCollectionAfterCreateSuccess().trigger(event);
}

async function triggerCollectionUpdateHooks(app: BaseApp, collection: CollectionModel): Promise<void> {
  const event: CollectionEvent = {
    app,
    collection,
    next: async () => {},
  };
  await app.onCollectionAfterUpdateSuccess().trigger(event);
}

async function triggerCollectionDeleteHooks(app: BaseApp, collection: CollectionModel): Promise<void> {
  const event: CollectionEvent = {
    app,
    collection,
    next: async () => {},
  };
  await app.onCollectionAfterDeleteSuccess().trigger(event);
}

// ─── 类型检测辅助 ───

function isRecord(model: unknown): model is RecordModel {
  return model !== null && typeof model === "object" && "collection" in model && typeof (model as any).collection === "function" && "getData" in model;
}

function isCollection(model: unknown): model is CollectionModel {
  return model !== null && typeof model === "object" && "isAuth" in model && typeof (model as any).isAuth === "function";
}
