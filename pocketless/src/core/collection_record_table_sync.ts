/**
 * T025 — collection_record_table_sync.ts
 * 对照 Go 版 core/collection_record_table_sync.go
 * 将集合 schema 变更同步到实际数据库表
 */

import type { BaseApp } from "./base";
import type { CollectionModel, CollectionField } from "./collection_model";
import { parseIndex } from "../tools/dbutils/index";

const FIELD_TYPE_TO_COLUMN: Record<string, string> = {
  text: "TEXT DEFAULT ''",
  number: "NUMERIC DEFAULT 0",
  bool: "BOOLEAN DEFAULT FALSE",
  date: "TEXT DEFAULT ''",
  autodate: "TEXT DEFAULT ''",
  email: "TEXT DEFAULT ''",
  url: "TEXT DEFAULT ''",
  editor: "TEXT DEFAULT ''",
  select: "TEXT DEFAULT ''",
  file: "TEXT DEFAULT ''",
  relation: "TEXT DEFAULT ''",
  json: "JSON DEFAULT 'null'",
  password: "TEXT DEFAULT ''",
  geopoint: "TEXT DEFAULT ''",
  secret: "TEXT DEFAULT ''",
  vector: "TEXT DEFAULT ''",
};

function getColumnType(fieldType: string): string {
  return FIELD_TYPE_TO_COLUMN[fieldType] || "TEXT DEFAULT ''";
}

export async function syncRecordTableSchema(
  app: BaseApp,
  newCollection: CollectionModel,
  oldCollection: CollectionModel | null,
): Promise<void> {
  const adapter = app.dbAdapter();
  const tableName = newCollection.name;

  if (!oldCollection || oldCollection.isNew()) {
    createTable(adapter, newCollection);
    createCollectionIndexes(adapter, newCollection);
    return;
  }

  const oldTableName = oldCollection.name;
  const needsIndexRebuild = hasSchemaChanges(newCollection, oldCollection);

  // 1. Drop old indexes
  if (needsIndexRebuild) {
    dropCollectionIndexes(adapter, oldCollection);
  }

  // 2. Rename table if name changed
  if (oldTableName !== tableName) {
    adapter.exec(`ALTER TABLE ${quoteId(oldTableName)} RENAME TO ${quoteId(tableName)}`);
  }

  // 3. Drop removed columns
  const newFieldIds = new Set(newCollection.fields.map((f) => f.id));
  for (const oldField of oldCollection.fields) {
    if (oldField.name === "id") continue;
    if (!newFieldIds.has(oldField.id)) {
      try {
        adapter.exec(`ALTER TABLE ${quoteId(tableName)} DROP COLUMN ${quoteId(oldField.name)}`);
      } catch {
        // Column may not exist
      }
    }
  }

  // 4. Add new columns and rename existing ones
  const oldFieldMap = new Map(oldCollection.fields.map((f) => [f.id, f]));

  for (const newField of newCollection.fields) {
    if (newField.name === "id") continue;

    const oldField = oldFieldMap.get(newField.id);

    if (!oldField) {
      // New field — add column
      const colType = getColumnType(newField.type);
      adapter.exec(`ALTER TABLE ${quoteId(tableName)} ADD COLUMN ${quoteId(newField.name)} ${colType}`);
    } else if (oldField.name !== newField.name) {
      // Renamed field — rename column
      adapter.exec(
        `ALTER TABLE ${quoteId(tableName)} RENAME COLUMN ${quoteId(oldField.name)} TO ${quoteId(newField.name)}`,
      );
    }
  }

  // 5. Rebuild indexes
  if (needsIndexRebuild) {
    createCollectionIndexes(adapter, newCollection);
  }
}

function createTable(adapter: any, collection: CollectionModel): void {
  const columns: string[] = [];

  for (const field of collection.fields) {
    if (field.name === "id") {
      columns.push(`${quoteId("id")} TEXT PRIMARY KEY DEFAULT ''`);
    } else {
      const colType = getColumnType(field.type);
      columns.push(`${quoteId(field.name)} ${colType}`);
    }
  }

  // Always add created/updated if not in fields
  const fieldNames = new Set(collection.fields.map((f) => f.name));
  if (!fieldNames.has("created")) {
    columns.push(`${quoteId("created")} TEXT DEFAULT ''`);
  }
  if (!fieldNames.has("updated")) {
    columns.push(`${quoteId("updated")} TEXT DEFAULT ''`);
  }

  const sql = `CREATE TABLE IF NOT EXISTS ${quoteId(collection.name)} (${columns.join(", ")})`;
  adapter.exec(sql);
}

function createCollectionIndexes(adapter: any, collection: CollectionModel): void {
  if (!collection.indexes) return;

  for (const indexStr of collection.indexes) {
    const parsed = parseIndex(indexStr);
    if (!parsed.isValid()) continue;

    // Ensure index points to the correct table
    parsed.tableName = collection.name;
    const sql = parsed.build();
    if (sql) {
      try {
        adapter.exec(sql);
      } catch {
        // Index may already exist
      }
    }
  }
}

function dropCollectionIndexes(adapter: any, collection: CollectionModel): void {
  if (!collection.indexes) return;

  for (const indexStr of collection.indexes) {
    const parsed = parseIndex(indexStr);
    if (!parsed.isValid()) continue;

    try {
      adapter.exec(`DROP INDEX IF EXISTS ${quoteId(parsed.indexName)}`);
    } catch {
      // Ignore
    }
  }
}

function hasSchemaChanges(newCol: CollectionModel, oldCol: CollectionModel): boolean {
  if (newCol.name !== oldCol.name) return true;

  // Check if fields changed
  if (newCol.fields.length !== oldCol.fields.length) return true;

  const oldFieldMap = new Map(oldCol.fields.map((f) => [f.id, f]));
  for (const f of newCol.fields) {
    const old = oldFieldMap.get(f.id);
    if (!old || old.name !== f.name || old.type !== f.type) return true;
  }

  // Check if indexes changed
  if (JSON.stringify(newCol.indexes) !== JSON.stringify(oldCol.indexes)) return true;

  return false;
}

function quoteId(name: string): string {
  return `\`${name}\``;
}
