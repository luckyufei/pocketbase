/**
 * BaseModel — 所有模型的基类
 * 与 Go 版 core.BaseModel 对齐
 */

import { generateId } from "../tools/security/random";
import { DateTime } from "../tools/types/datetime";

export class BaseModel {
  id: string;
  created: string;
  updated: string;

  private _isNew: boolean = true;
  private _tableName: string;

  constructor(tableName: string) {
    this._tableName = tableName;
    this.id = generateId();
    this.created = "";
    this.updated = "";
  }

  /** 获取表名 */
  tableName(): string {
    return this._tableName;
  }

  /** 是否为新记录（未保存到数据库） */
  isNew(): boolean {
    return this._isNew;
  }

  /** 标记为非新记录（从数据库加载时） */
  markAsNotNew(): void {
    this._isNew = false;
  }

  /** 标记为新记录 */
  markAsNew(): void {
    this._isNew = true;
  }

  /** 设置创建/更新时间戳 */
  refreshTimestamps(): void {
    const now = DateTime.now().toSQLite();
    if (this._isNew) {
      this.created = now;
    }
    this.updated = now;
  }

  /** 从数据库行数据填充 */
  load(data: Record<string, unknown>): void {
    if (data.id) this.id = data.id as string;
    if (data.created) this.created = data.created as string;
    if (data.updated) this.updated = data.updated as string;
    this._isNew = false;
  }

  /** 导出为 JSON 对象 */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      created: this.created,
      updated: this.updated,
    };
  }
}
