/**
 * SelectField — 选择字段（单选/多选）
 * 与 Go 版 core/field_select.go 对齐
 */

import { registerField, type Field } from "./field";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

export class SelectField implements Field {
  id: string;
  name: string;
  type = "select";
  system: boolean;
  hidden: boolean;
  required: boolean;
  values: string[];
  maxSelect: number;

  constructor(options: Record<string, unknown> = {}) {
    this.id = (options.id as string) || "";
    this.name = (options.name as string) || "";
    this.system = !!(options.system);
    this.hidden = !!(options.hidden);
    this.required = !!(options.required);
    this.values = (options.values as string[]) || [];
    this.maxSelect = (options.maxSelect as number) || 1;
  }

  isMultiple(): boolean {
    return this.maxSelect > 1;
  }

  columnType(isPostgres?: boolean): string {
    if (this.isMultiple()) {
      return isPostgres ? "JSONB DEFAULT '[]' NOT NULL" : "JSON DEFAULT '[]' NOT NULL";
    }
    return "TEXT DEFAULT '' NOT NULL";
  }

  prepareValue(raw: unknown): string | string[] {
    const arr = toUniqueStringSlice(raw);
    if (!this.isMultiple()) {
      return arr.length > 0 ? arr[arr.length - 1] : "";
    }
    return arr;
  }

  validateValue(value: unknown, _record: RecordModel): string | null {
    const arr = toUniqueStringSlice(value);
    if (arr.length === 0 && this.required) return "不能为空";
    if (arr.length === 0) return null;
    const max = Math.max(this.maxSelect, 1);
    if (arr.length > max) return `最多选择 ${max} 个`;
    for (const v of arr) {
      if (!this.values.includes(v)) return `无效选项: ${v}`;
    }
    return null;
  }

  validateSettings(_collection: CollectionModel): string | null {
    if (this.values.length === 0) return "至少需要一个选项值";
    return null;
  }

  driverValue(value: unknown): unknown {
    if (this.isMultiple()) {
      return JSON.stringify(toUniqueStringSlice(value));
    }
    return typeof value === "string" ? value : String(value ?? "");
  }
}

function toUniqueStringSlice(raw: unknown): string[] {
  let arr: string[];
  if (Array.isArray(raw)) {
    arr = raw.map(String).filter(Boolean);
  } else if (typeof raw === "string") {
    if (raw.startsWith("[")) {
      try { arr = JSON.parse(raw).map(String).filter(Boolean); } catch { arr = raw ? [raw] : []; }
    } else {
      arr = raw ? [raw] : [];
    }
  } else if (raw != null && raw !== false) {
    const s = String(raw);
    arr = s ? [s] : [];
  } else {
    arr = [];
  }
  return [...new Set(arr)];
}

registerField("select", (opts) => new SelectField(opts));
