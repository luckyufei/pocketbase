/**
 * JSONField — JSON 字段
 * 与 Go 版 core/field_json.go 对齐
 */

import { registerField, type Field } from "./field";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

const DEFAULT_MAX_SIZE = 1 << 20; // 1MB

export class JSONField implements Field {
  id: string;
  name: string;
  type = "json";
  system: boolean;
  hidden: boolean;
  required: boolean;
  maxSize: number;

  constructor(options: Record<string, unknown> = {}) {
    this.id = (options.id as string) || "";
    this.name = (options.name as string) || "";
    this.system = !!(options.system);
    this.hidden = !!(options.hidden);
    this.required = !!(options.required);
    this.maxSize = (options.maxSize as number) || 0;
  }

  columnType(isPostgres?: boolean): string {
    return isPostgres ? "JSONB DEFAULT NULL" : "JSON DEFAULT NULL";
  }

  prepareValue(raw: unknown): unknown {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "string") {
      if (raw === "") return null;
      try { return JSON.parse(raw); } catch { return raw; }
    }
    return raw;
  }

  validateValue(value: unknown, _record: RecordModel): string | null {
    if (value === null || value === undefined) {
      if (this.required) return "不能为空";
      return null;
    }
    const str = typeof value === "string" ? value : JSON.stringify(value);
    const effectiveMax = this.maxSize || DEFAULT_MAX_SIZE;
    const byteLength = new TextEncoder().encode(str).length;
    if (byteLength > effectiveMax) return `内容过大（最大 ${effectiveMax} 字节）`;
    if (typeof value === "string") {
      try { JSON.parse(value); } catch { return "无效的 JSON 格式"; }
    }
    if (this.required) {
      const s = typeof value === "string" ? value : JSON.stringify(value);
      if (s === "null" || s === '""' || s === "[]" || s === "{}") return "不能为空";
    }
    return null;
  }

  validateSettings(_collection: CollectionModel): string | null {
    return null;
  }

  driverValue(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    return typeof value === "string" ? value : JSON.stringify(value);
  }
}

registerField("json", (opts) => new JSONField(opts));
