/**
 * FileField — 文件字段（单文件/多文件）
 * 与 Go 版 core/field_file.go 对齐
 */

import { registerField, type Field } from "./field";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

const DEFAULT_MAX_SIZE = 5 << 20; // 5MB

export class FileField implements Field {
  id: string;
  name: string;
  type = "file";
  system: boolean;
  hidden: boolean;
  required: boolean;
  maxSize: number;
  maxSelect: number;
  mimeTypes: string[];
  thumbs: string[];
  protected_: boolean;

  constructor(options: Record<string, unknown> = {}) {
    this.id = (options.id as string) || "";
    this.name = (options.name as string) || "";
    this.system = !!(options.system);
    this.hidden = !!(options.hidden);
    this.required = !!(options.required);
    this.maxSize = (options.maxSize as number) || DEFAULT_MAX_SIZE;
    this.maxSelect = (options.maxSelect as number) || 1;
    this.mimeTypes = (options.mimeTypes as string[]) || [];
    this.thumbs = (options.thumbs as string[]) || [];
    this.protected_ = !!(options.protected);
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
    const arr = toStringSlice(raw);
    if (!this.isMultiple()) {
      return arr.length > 0 ? arr[arr.length - 1] : "";
    }
    return arr;
  }

  validateValue(value: unknown, _record: RecordModel): string | null {
    const arr = toStringSlice(value);
    if (arr.length === 0 && this.required) return "不能为空";
    if (arr.length === 0) return null;
    const max = Math.max(this.maxSelect, 1);
    if (arr.length > max) return `最多 ${max} 个文件`;
    return null;
  }

  validateSettings(_collection: CollectionModel): string | null {
    return null;
  }

  driverValue(value: unknown): unknown {
    if (this.isMultiple()) {
      return JSON.stringify(toStringSlice(value));
    }
    return typeof value === "string" ? value : String(value ?? "");
  }
}

function toStringSlice(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    if (raw.startsWith("[")) {
      try { return JSON.parse(raw).map(String).filter(Boolean); } catch { return raw ? [raw] : []; }
    }
    return raw ? [raw] : [];
  }
  if (raw != null && raw !== false) {
    const s = String(raw);
    return s ? [s] : [];
  }
  return [];
}

registerField("file", (opts) => new FileField(opts));
