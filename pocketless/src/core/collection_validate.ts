/**
 * T024 — collection_validate.ts
 * 对照 Go 版 core/collection_validate.go
 * 集合验证逻辑
 */

import type { BaseApp } from "./base";
import type { CollectionModel, CollectionField } from "./collection_model";
import { COLLECTION_TYPE_BASE, COLLECTION_TYPE_AUTH, COLLECTION_TYPE_VIEW } from "./collection_model";
import { parseIndex } from "../tools/dbutils/index";
import { generateId } from "../tools/security/random";

const VALID_TYPES = [COLLECTION_TYPE_BASE, COLLECTION_TYPE_AUTH, COLLECTION_TYPE_VIEW];

const NAME_REGEX = /^\w+$/;

const DEFAULT_ID_REGEX = /^[a-z0-9]+$/i;

const INTERNAL_TABLE_NAMES = new Set([
  "_collections",
  "_params",
  "_admins",
  "_migrations",
  "_externalAuths",
  "_authOrigins",
  "_mfas",
  "_otps",
  "_superusers",
  "_logs",
  "_secrets",
  "_jobs",
  "_metrics",
  "sqlite_master",
  "sqlite_sequence",
  "sqlite_stat1",
  "sqlite_stat2",
  "sqlite_stat3",
  "sqlite_stat4",
]);

const AUTH_RESERVED_FIELD_NAMES = new Set([
  "passwordConfirm",
  "oldPassword",
]);

interface ValidationError {
  field: string;
  message: string;
}

class CollectionValidationError extends Error {
  errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    const messages = errors.map((e) => `${e.field}: ${e.message}`).join("; ");
    super(`Collection validation failed: ${messages}`);
    this.name = "CollectionValidationError";
    this.errors = errors;
  }
}

export async function validateCollection(
  app: BaseApp,
  collection: CollectionModel,
  original?: CollectionModel | null,
): Promise<void> {
  // 如果不是更新操作，尝试从 DB 加载原始版本
  if (!original && !collection.isNew()) {
    original = await fetchOriginal(app, collection.id);
  }

  // 如果没有原始版本，创建空占位
  if (!original) {
    original = null;
  }

  const errors: ValidationError[] = [];

  // 自动生成 ID（仅新集合）
  if (collection.isNew() && !collection.id) {
    collection.id = generateId();
  }

  validateId(collection, original, errors);
  validateSystem(collection, original, errors);
  validateType(collection, original, errors);
  validateName(app, collection, original, errors);
  validateFields(collection, original, errors);
  validateRules(collection, original, errors);
  validateIndexes(app, collection, original, errors);

  if (errors.length > 0) {
    throw new CollectionValidationError(errors);
  }
}

async function fetchOriginal(app: BaseApp, id: string): Promise<CollectionModel | null> {
  try {
    const row = app.dbAdapter().queryOne(
      `SELECT * FROM _collections WHERE id = ?`,
      id,
    );
    if (!row) return null;
    const { CollectionModel: CM } = await import("./collection_model");
    const col = new CM();
    col.load(row as Record<string, unknown>);
    return col;
  } catch {
    return null;
  }
}

function validateId(
  collection: CollectionModel,
  original: CollectionModel | null,
  errors: ValidationError[],
): void {
  if (!collection.id) {
    errors.push({ field: "id", message: "ID is required." });
    return;
  }

  if (original && !original.isNew()) {
    // 更新模式：不可修改 ID
    if (collection.id !== original.id) {
      errors.push({ field: "id", message: "ID cannot be changed." });
    }
  } else {
    // 新建模式
    if (collection.id.length > 100) {
      errors.push({ field: "id", message: "ID length must not exceed 100 characters." });
    }
    if (!DEFAULT_ID_REGEX.test(collection.id)) {
      errors.push({ field: "id", message: "ID must contain only alphanumeric characters." });
    }
  }
}

function validateSystem(
  collection: CollectionModel,
  original: CollectionModel | null,
  errors: ValidationError[],
): void {
  if (original && !original.isNew()) {
    if (collection.system !== original.system) {
      errors.push({ field: "system", message: "System flag cannot be changed." });
    }
  }
}

function validateType(
  collection: CollectionModel,
  original: CollectionModel | null,
  errors: ValidationError[],
): void {
  if (!collection.type) {
    errors.push({ field: "type", message: "Type is required." });
    return;
  }

  if (!VALID_TYPES.includes(collection.type)) {
    errors.push({ field: "type", message: `Type must be one of: ${VALID_TYPES.join(", ")}.` });
    return;
  }

  if (original && !original.isNew() && collection.type !== original.type) {
    errors.push({ field: "type", message: "Type cannot be changed." });
  }
}

function validateName(
  app: BaseApp,
  collection: CollectionModel,
  original: CollectionModel | null,
  errors: ValidationError[],
): void {
  if (!collection.name) {
    errors.push({ field: "name", message: "Name is required." });
    return;
  }

  if (collection.name.length > 255) {
    errors.push({ field: "name", message: "Name length must not exceed 255 characters." });
    return;
  }

  if (!NAME_REGEX.test(collection.name)) {
    errors.push({ field: "name", message: "Name must contain only word characters (letters, digits, underscores)." });
    return;
  }

  // 内部表名冲突
  if (INTERNAL_TABLE_NAMES.has(collection.name) || collection.name.startsWith("_")) {
    errors.push({ field: "name", message: "Name conflicts with an internal table name." });
    return;
  }

  // system 集合不可改名
  if (original && !original.isNew() && original.system && collection.name !== original.name) {
    errors.push({ field: "name", message: "System collection name cannot be changed." });
    return;
  }

  // 唯一性检查
  try {
    const existing = app.dbAdapter().queryOne(
      `SELECT id FROM _collections WHERE name = ? AND id != ?`,
      collection.name,
      collection.id || "",
    );
    if (existing) {
      errors.push({ field: "name", message: "Collection name must be unique." });
    }
  } catch {
    // 忽略查询错误
  }
}

function validateFields(
  collection: CollectionModel,
  original: CollectionModel | null,
  errors: ValidationError[],
): void {
  if (!collection.fields || collection.fields.length === 0) {
    errors.push({ field: "fields", message: "At least one field is required." });
    return;
  }

  // 检查是否有 id 字段
  const hasIdField = collection.fields.some((f) => f.name === "id");
  if (!hasIdField) {
    errors.push({ field: "fields", message: 'The "id" field is required.' });
  }

  // 检查重复名称
  const names = new Set<string>();
  for (const field of collection.fields) {
    if (names.has(field.name)) {
      errors.push({ field: "fields", message: `Duplicate field name "${field.name}".` });
    }
    names.add(field.name);
  }

  // 检查重复 ID
  const ids = new Set<string>();
  for (const field of collection.fields) {
    if (ids.has(field.id)) {
      errors.push({ field: "fields", message: `Duplicate field ID "${field.id}".` });
    }
    ids.add(field.id);
  }

  // Auth 集合保留字段名检查
  if (collection.type === COLLECTION_TYPE_AUTH) {
    for (const field of collection.fields) {
      if (AUTH_RESERVED_FIELD_NAMES.has(field.name)) {
        errors.push({ field: "fields", message: `Field name "${field.name}" is reserved for auth collections.` });
      }
    }
  }

  // 更新模式：不可修改 system 字段类型
  if (original && !original.isNew()) {
    for (const newField of collection.fields) {
      const oldField = original.fields.find((f) => f.id === newField.id);
      if (oldField && isSystemField(oldField.name) && oldField.type !== newField.type) {
        errors.push({ field: "fields", message: `Cannot change type of system field "${oldField.name}".` });
      }
    }
  }
}

function isSystemField(name: string): boolean {
  return ["id", "created", "updated", "password", "tokenKey", "email", "emailVisibility", "verified"].includes(name);
}

function validateRules(
  collection: CollectionModel,
  original: CollectionModel | null,
  errors: ValidationError[],
): void {
  // View 集合 create/update/delete 规则必须为 null
  if (collection.type === COLLECTION_TYPE_VIEW) {
    if (collection.createRule !== null) {
      errors.push({ field: "createRule", message: "View collections cannot have a create rule." });
    }
    if (collection.updateRule !== null) {
      errors.push({ field: "updateRule", message: "View collections cannot have an update rule." });
    }
    if (collection.deleteRule !== null) {
      errors.push({ field: "deleteRule", message: "View collections cannot have a delete rule." });
    }
  }
}

function validateIndexes(
  app: BaseApp,
  collection: CollectionModel,
  original: CollectionModel | null,
  errors: ValidationError[],
): void {
  if (!collection.indexes || collection.indexes.length === 0) return;

  // View 集合不支持索引
  if (collection.type === COLLECTION_TYPE_VIEW) {
    errors.push({ field: "indexes", message: "View collections cannot have indexes." });
    return;
  }

  const indexNames = new Set<string>();

  for (const indexStr of collection.indexes) {
    const parsed = parseIndex(indexStr);

    if (!parsed.isValid()) {
      errors.push({ field: "indexes", message: `Invalid index: "${indexStr}".` });
      continue;
    }

    // 检查索引名唯一
    if (indexNames.has(parsed.indexName)) {
      errors.push({ field: "indexes", message: `Duplicate index name "${parsed.indexName}".` });
    }
    indexNames.add(parsed.indexName);
  }
}
