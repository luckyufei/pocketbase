/**
 * Collection 模型 — 集合定义
 * 与 Go 版 core.Collection 对齐
 */

import { BaseModel } from "./base_model";

export const COLLECTION_TYPE_BASE = "base";
export const COLLECTION_TYPE_AUTH = "auth";
export const COLLECTION_TYPE_VIEW = "view";

export interface CollectionField {
  id: string;
  name: string;
  type: string;
  required: boolean;
  options: Record<string, unknown>;
}

export class CollectionModel extends BaseModel {
  type: string = COLLECTION_TYPE_BASE;
  name: string = "";
  system: boolean = false;
  fields: CollectionField[] = [];
  indexes: string[] = [];
  listRule: string | null = null;
  viewRule: string | null = null;
  createRule: string | null = null;
  updateRule: string | null = null;
  deleteRule: string | null = null;
  options: Record<string, unknown> = {};

  constructor() {
    super("_collections");
  }

  /** 是否为 Auth 集合 */
  isAuth(): boolean {
    return this.type === COLLECTION_TYPE_AUTH;
  }

  /** 是否为 View 集合 */
  isView(): boolean {
    return this.type === COLLECTION_TYPE_VIEW;
  }

  /** 是否为 Base 集合 */
  isBase(): boolean {
    return this.type === COLLECTION_TYPE_BASE;
  }

  /** 获取指定名称的字段 */
  getFieldByName(name: string): CollectionField | undefined {
    return this.fields.find((f) => f.name === name);
  }

  /** 获取指定 ID 的字段 */
  getFieldById(id: string): CollectionField | undefined {
    return this.fields.find((f) => f.id === id);
  }

  /** 从数据库行数据填充 */
  override load(data: Record<string, unknown>): void {
    super.load(data);
    if (data.type) this.type = data.type as string;
    if (data.name) this.name = data.name as string;
    if (data.system !== undefined) this.system = !!data.system;
    if (data.fields) {
      this.fields = typeof data.fields === "string" ? JSON.parse(data.fields) : data.fields as CollectionField[];
    }
    if (data.indexes) {
      this.indexes = typeof data.indexes === "string" ? JSON.parse(data.indexes) : data.indexes as string[];
    }
    this.listRule = (data.listRule as string | null) ?? null;
    this.viewRule = (data.viewRule as string | null) ?? null;
    this.createRule = (data.createRule as string | null) ?? null;
    this.updateRule = (data.updateRule as string | null) ?? null;
    this.deleteRule = (data.deleteRule as string | null) ?? null;
    if (data.options) {
      this.options = typeof data.options === "string" ? JSON.parse(data.options) : data.options as Record<string, unknown>;
    }
  }

  /** 导出为 JSON */
  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      type: this.type,
      name: this.name,
      system: this.system,
      fields: this.fields,
      indexes: this.indexes,
      listRule: this.listRule,
      viewRule: this.viewRule,
      createRule: this.createRule,
      updateRule: this.updateRule,
      deleteRule: this.deleteRule,
      options: this.options,
    };
  }

  /** 导出为数据库行（JSON 字段序列化） */
  toDBRow(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      system: this.system ? 1 : 0,
      fields: JSON.stringify(this.fields),
      indexes: JSON.stringify(this.indexes),
      listRule: this.listRule,
      viewRule: this.viewRule,
      createRule: this.createRule,
      updateRule: this.updateRule,
      deleteRule: this.deleteRule,
      options: JSON.stringify(this.options),
      created: this.created,
      updated: this.updated,
    };
  }
}
