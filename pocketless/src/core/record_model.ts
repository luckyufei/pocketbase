/**
 * Record 模型 — 动态数据记录
 * 与 Go 版 core.Record 对齐
 */

import { BaseModel } from "./base_model";
import type { CollectionModel } from "./collection_model";

export class RecordModel extends BaseModel {
  private _collection: CollectionModel;
  private _data: Map<string, unknown> = new Map();
  private _expand: Record<string, unknown> = {};
  private _originalData: Map<string, unknown> = new Map();

  constructor(collection: CollectionModel) {
    super(collection.name);
    this._collection = collection;
  }

  /** 获取关联的 Collection */
  collection(): CollectionModel {
    return this._collection;
  }

  /** Collection ID */
  get collectionId(): string {
    return this._collection.id;
  }

  /** Collection 名称 */
  get collectionName(): string {
    return this._collection.name;
  }

  /** 获取字段值 */
  get(key: string): unknown {
    if (key === "id") return this.id;
    if (key === "created") return this.created;
    if (key === "updated") return this.updated;
    if (key === "collectionId") return this.collectionId;
    if (key === "collectionName") return this.collectionName;
    return this._data.get(key);
  }

  /** 设置字段值 */
  set(key: string, value: unknown): void {
    if (key === "id") {
      this.id = value as string;
      return;
    }
    if (key === "created") {
      this.created = value as string;
      return;
    }
    if (key === "updated") {
      this.updated = value as string;
      return;
    }
    this._data.set(key, value);
  }

  /** 获取所有自定义字段数据 */
  getData(): Map<string, unknown> {
    return new Map(this._data);
  }

  /** 设置展开数据 */
  setExpand(key: string, data: unknown): void {
    this._expand[key] = data;
  }

  /** 获取展开数据 */
  getExpand(): Record<string, unknown> {
    return { ...this._expand };
  }

  /** 检查字段是否变更 */
  isFieldChanged(key: string): boolean {
    return this._data.get(key) !== this._originalData.get(key);
  }

  // ─── Auth 专用方法 ───

  /** 获取邮箱（Auth 集合专用） */
  getEmail(): string {
    return (this.get("email") as string) || "";
  }

  /** 设置邮箱 */
  setEmail(email: string): void {
    this.set("email", email);
  }

  /** 是否已验证 */
  isVerified(): boolean {
    return !!this.get("verified");
  }

  /** 获取 Token Key */
  getTokenKey(): string {
    return (this.get("tokenKey") as string) || "";
  }

  /** 获取密码哈希 */
  getPasswordHash(): string {
    return (this.get("password") as string) || "";
  }

  /** 邮箱是否可见 */
  isEmailVisible(): boolean {
    return !!this.get("emailVisibility");
  }

  // ─── 字段修饰符 ───

  /** 应用字段修饰符：field+（追加），+field（前置），field-（移除） */
  applyModifier(key: string, value: unknown): void {
    if (key.endsWith("+")) {
      // 追加到数组末尾
      const fieldName = key.slice(0, -1);
      const current = this.get(fieldName);
      if (Array.isArray(current)) {
        const arr = [...current];
        if (Array.isArray(value)) arr.push(...value);
        else arr.push(value);
        this.set(fieldName, arr);
      }
    } else if (key.startsWith("+")) {
      // 前置到数组开头
      const fieldName = key.slice(1);
      const current = this.get(fieldName);
      if (Array.isArray(current)) {
        const arr = [...current];
        if (Array.isArray(value)) arr.unshift(...value);
        else arr.unshift(value);
        this.set(fieldName, arr);
      }
    } else if (key.endsWith("-")) {
      // 从数组移除
      const fieldName = key.slice(0, -1);
      const current = this.get(fieldName);
      if (Array.isArray(current)) {
        const toRemove = Array.isArray(value) ? value : [value];
        this.set(
          fieldName,
          current.filter((item) => !toRemove.includes(item)),
        );
      }
    } else {
      this.set(key, value);
    }
  }

  /** 从数据库行数据填充 */
  override load(data: Record<string, unknown>): void {
    super.load(data);
    for (const [key, value] of Object.entries(data)) {
      if (key !== "id" && key !== "created" && key !== "updated") {
        this._data.set(key, value);
      }
    }
    this._originalData = new Map(this._data);
  }

  /** 导出为 JSON（API 响应格式） */
  override toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      ...super.toJSON(),
      collectionId: this.collectionId,
      collectionName: this.collectionName,
    };

    for (const [key, value] of this._data) {
      // password 字段不输出
      const field = this._collection.getFieldByName(key);
      if (field?.type === "password") continue;

      // emailVisibility 控制 email 是否输出
      if (key === "email" && !this.isEmailVisible()) continue;

      result[key] = value;
    }

    if (Object.keys(this._expand).length > 0) {
      result.expand = this._expand;
    }

    return result;
  }

  /** 导出为数据库行 */
  toDBRow(): Record<string, unknown> {
    const row: Record<string, unknown> = {
      id: this.id,
      created: this.created,
      updated: this.updated,
    };
    for (const [key, value] of this._data) {
      row[key] = value;
    }
    return row;
  }
}
