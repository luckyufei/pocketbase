/**
 * TextField — 文本字段
 * 与 Go 版 core/field_text.go 对齐
 */

import { registerField, type Field } from "./field";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

const DEFAULT_LOWERCASE_RECORD_ID_PATTERN = "^[a-z0-9]+$";

const FORBIDDEN_PK_CHARACTERS = [
  ".", "/", "\\", "|", '"', "'", "`",
  "<", ">", ":", "?", "*", "%", "$",
  "\0", "\t", "\n", "\r", " ",
];

const CASE_INSENSITIVE_RESERVED_PKS = [
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

const LARGEST_RESERVED_PK_LENGTH = 4;
const SAFE_JSON_INT = 2 ** 53 - 1;

export class TextField implements Field {
  id: string;
  name: string;
  type = "text";
  system: boolean;
  hidden: boolean;
  required: boolean;
  min: number;
  max: number;
  pattern: string;
  autogeneratePattern: string;
  primaryKey: boolean;

  constructor(options: Record<string, unknown> = {}) {
    this.id = (options.id as string) || "";
    this.name = (options.name as string) || "";
    this.system = !!(options.system);
    this.hidden = !!(options.hidden);
    this.required = !!(options.required);
    this.min = (options.min as number) || 0;
    this.max = (options.max as number) || 0;
    this.pattern = (options.pattern as string) || "";
    this.autogeneratePattern = (options.autogeneratePattern as string) || "";
    this.primaryKey = !!(options.primaryKey);
  }

  columnType(_isPostgres?: boolean): string {
    if (this.primaryKey) {
      return "TEXT PRIMARY KEY NOT NULL";
    }
    return "TEXT DEFAULT '' NOT NULL";
  }

  prepareValue(raw: unknown): string {
    if (raw === null || raw === undefined) return "";
    return String(raw);
  }

  validateValue(value: unknown, _record: RecordModel): string | null {
    const v = typeof value === "string" ? value : String(value ?? "");

    // 主键字段始终必填
    if (this.primaryKey && !v) {
      return "主键不能为空";
    }

    if (!v && this.required) return "不能为空";
    if (!v) return null;

    const runes = [...v];
    const length = runes.length;
    const effectiveMax = this.max || 5000;

    if (this.min > 0 && length < this.min) return `最少 ${this.min} 个字符`;
    if (length > effectiveMax) return `最多 ${effectiveMax} 个字符`;

    if (this.pattern) {
      try {
        if (!new RegExp(this.pattern).test(v)) return `不匹配模式 ${this.pattern}`;
      } catch {
        return "无效的正则模式";
      }
    }

    // 主键特殊字符和保留字检查（仅在非默认ID模式时生效）
    if (this.primaryKey && this.pattern !== DEFAULT_LOWERCASE_RECORD_ID_PATTERN) {
      for (const ch of FORBIDDEN_PK_CHARACTERS) {
        if (v.includes(ch)) {
          return `'${ch}' 不是有效的主键字符`;
        }
      }

      if (LARGEST_RESERVED_PK_LENGTH >= length) {
        for (const reserved of CASE_INSENSITIVE_RESERVED_PKS) {
          if (v.toUpperCase() === reserved) {
            return `主键 '${reserved}' 是保留值，不能使用`;
          }
        }
      }
    }

    return null;
  }

  validateSettings(_collection: CollectionModel): string | null {
    if (this.min < 0) return "min 不能小于 0";
    if (this.min > SAFE_JSON_INT) return "min 超出安全范围";
    if (this.max < 0) return "max 不能小于 0";
    if (this.max > SAFE_JSON_INT) return "max 超出安全范围";
    if (this.max > 0 && this.min > this.max) return "min 不能大于 max";

    if (this.pattern) {
      try {
        new RegExp(this.pattern);
      } catch {
        return "pattern 不是有效的正则表达式";
      }
    }

    if (this.autogeneratePattern) {
      try {
        new RegExp(this.autogeneratePattern);
      } catch {
        return "autogeneratePattern 不是有效的正则表达式";
      }

      if (this.pattern && this.autogeneratePattern) {
        return "pattern 和 autogeneratePattern 不能同时设置";
      }
    }

    return null;
  }
}

registerField("text", (opts) => new TextField(opts));
