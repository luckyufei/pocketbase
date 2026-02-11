/**
 * DateField — 日期字段
 * 与 Go 版 core/field_date.go 对齐
 */

import { registerField, type Field } from "./field";
import { DateTime } from "../tools/types/datetime";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

export class DateField implements Field {
  id: string;
  name: string;
  type = "date";
  system: boolean;
  hidden: boolean;
  required: boolean;
  min: string;
  max: string;

  constructor(options: Record<string, unknown> = {}) {
    this.id = (options.id as string) || "";
    this.name = (options.name as string) || "";
    this.system = !!(options.system);
    this.hidden = !!(options.hidden);
    this.required = !!(options.required);
    this.min = (options.min as string) || "";
    this.max = (options.max as string) || "";
  }

  columnType(isPostgres?: boolean): string {
    if (isPostgres) return "TIMESTAMPTZ DEFAULT NULL";
    return "TEXT DEFAULT '' NOT NULL";
  }

  prepareValue(raw: unknown): string {
    if (raw === null || raw === undefined || raw === "") return "";
    if (raw instanceof Date) return DateTime.fromDate(raw).toSQLite();
    if (typeof raw === "string") {
      try {
        return DateTime.parse(raw).toSQLite();
      } catch {
        return "";
      }
    }
    return "";
  }

  validateValue(value: unknown, _record: RecordModel): string | null {
    const v = typeof value === "string" ? value : "";
    if (!v && this.required) return "不能为空";
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return "无效的日期格式";
    if (this.min) {
      const minDate = new Date(this.min);
      if (!isNaN(minDate.getTime()) && d < minDate) return `日期不能早于 ${this.min}`;
    }
    if (this.max) {
      const maxDate = new Date(this.max);
      if (!isNaN(maxDate.getTime()) && d > maxDate) return `日期不能晚于 ${this.max}`;
    }
    return null;
  }

  validateSettings(_collection: CollectionModel): string | null {
    return null;
  }
}

registerField("date", (opts) => new DateField(opts));
