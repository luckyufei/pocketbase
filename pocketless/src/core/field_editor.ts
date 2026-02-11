/**
 * EditorField — 富文本编辑器字段
 * 与 Go 版 core/field_editor.go 对齐
 */

import { registerField, type Field } from "./field";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

const DEFAULT_MAX_SIZE = 5 << 20; // 5MB

export class EditorField implements Field {
  id: string;
  name: string;
  type = "editor";
  system: boolean;
  hidden: boolean;
  required: boolean;
  maxSize: number;
  convertURLs: boolean;

  constructor(options: Record<string, unknown> = {}) {
    this.id = (options.id as string) || "";
    this.name = (options.name as string) || "";
    this.system = !!(options.system);
    this.hidden = !!(options.hidden);
    this.required = !!(options.required);
    this.maxSize = (options.maxSize as number) || 0;
    this.convertURLs = !!(options.convertURLs);
  }

  columnType(_isPostgres?: boolean): string {
    return "TEXT DEFAULT '' NOT NULL";
  }

  prepareValue(raw: unknown): string {
    if (raw === null || raw === undefined) return "";
    return String(raw);
  }

  validateValue(value: unknown, _record: RecordModel): string | null {
    const v = typeof value === "string" ? value : String(value ?? "");
    if (!v && this.required) return "不能为空";
    if (!v) return null;
    const effectiveMax = this.maxSize || DEFAULT_MAX_SIZE;
    const byteLength = new TextEncoder().encode(v).length;
    if (byteLength > effectiveMax) return `内容过大（最大 ${effectiveMax} 字节）`;
    return null;
  }

  validateSettings(_collection: CollectionModel): string | null {
    if (this.maxSize < 0) return "maxSize 不能小于 0";
    if (this.maxSize > 2 ** 53 - 1) return "maxSize 超出安全范围";
    return null;
  }
}

registerField("editor", (opts) => new EditorField(opts));
