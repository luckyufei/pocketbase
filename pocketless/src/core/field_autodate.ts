/**
 * AutodateField — 自动日期字段
 * 与 Go 版 core/field_autodate.go 对齐
 * 创建/更新时自动设置当前时间
 */

import { registerField, type Field } from "./field";
import { DateTime } from "../tools/types/datetime";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

export class AutodateField implements Field {
  id: string;
  name: string;
  type = "autodate";
  system: boolean;
  hidden: boolean;
  required = false;
  onCreate: boolean;
  onUpdate: boolean;

  constructor(options: Record<string, unknown> = {}) {
    this.id = (options.id as string) || "";
    this.name = (options.name as string) || "";
    this.system = !!(options.system);
    this.hidden = !!(options.hidden);
    this.onCreate = options.onCreate !== undefined ? !!(options.onCreate) : true;
    this.onUpdate = options.onUpdate !== undefined ? !!(options.onUpdate) : true;
  }

  columnType(isPostgres?: boolean): string {
    if (isPostgres) return "TIMESTAMPTZ DEFAULT NULL";
    return "TEXT DEFAULT '' NOT NULL";
  }

  prepareValue(raw: unknown): string {
    if (raw === null || raw === undefined || raw === "") return "";
    if (raw instanceof Date) return new DateTime(raw).toSQLite();
    if (typeof raw === "string") {
      try {
        return DateTime.parse(raw).toSQLite();
      } catch {
        return "";
      }
    }
    return "";
  }

  validateValue(_value: unknown, _record: RecordModel): string | null {
    return null;
  }

  validateSettings(_collection: CollectionModel): string | null {
    return null;
  }
}

registerField("autodate", (opts) => new AutodateField(opts));
