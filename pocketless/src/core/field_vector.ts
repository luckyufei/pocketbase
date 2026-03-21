/**
 * VectorField — 向量字段
 * 与 Go 版 core/field_vector.go 对齐
 * SQLite: JSON 数组, PostgreSQL: pgvector VECTOR(dim)
 */

import { registerField, type Field } from "./field";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

const MAX_VECTOR_DIMENSION = 16000;

export const VECTOR_INDEX_HNSW = "hnsw";
export const VECTOR_INDEX_IVFFLAT = "ivfflat";
export const VECTOR_DISTANCE_L2 = "l2";
export const VECTOR_DISTANCE_COSINE = "cosine";
export const VECTOR_DISTANCE_IP = "ip";

export class VectorField implements Field {
  id: string;
  name: string;
  type = "vector";
  system: boolean;
  hidden: boolean;
  required: boolean;
  dimension: number;
  indexType: string;
  distanceFunc: string;

  constructor(options: Record<string, unknown> = {}) {
    this.id = (options.id as string) || "";
    this.name = (options.name as string) || "";
    this.system = !!(options.system);
    this.hidden = !!(options.hidden);
    this.required = !!(options.required);
    this.dimension = (options.dimension as number) || 0;
    this.indexType = (options.indexType as string) || "";
    this.distanceFunc = (options.distanceFunc as string) || "";
  }

  columnType(isPostgres?: boolean): string {
    if (isPostgres) {
      return this.dimension > 0 ? `vector(${this.dimension})` : "vector";
    }
    return "JSON DEFAULT '[]' NOT NULL";
  }

  prepareValue(raw: unknown): number[] {
    if (raw === null || raw === undefined) return [];
    if (Array.isArray(raw)) return raw.map(Number).filter((n) => isFinite(n));
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(Number).filter((n) => isFinite(n));
      } catch {}
      // pgvector "[1,2,3]" 格式
      if (raw.startsWith("[") && raw.endsWith("]")) {
        try {
          return raw.slice(1, -1).split(",").map(Number).filter((n) => isFinite(n));
        } catch {}
      }
    }
    return [];
  }

  validateValue(value: unknown, _record: RecordModel): string | null {
    const vec = Array.isArray(value) ? value : [];
    if (vec.length === 0 && this.required) return "不能为空";
    if (vec.length === 0) return null;
    if (this.dimension > 0 && vec.length !== this.dimension) {
      return `维度不匹配（期望 ${this.dimension}，实际 ${vec.length}）`;
    }
    if (vec.length > MAX_VECTOR_DIMENSION) return `维度超过上限 ${MAX_VECTOR_DIMENSION}`;
    for (const v of vec) {
      if (typeof v !== "number" || !isFinite(v)) return "包含无效数值";
    }
    return null;
  }

  validateSettings(_collection: CollectionModel): string | null {
    if (this.dimension < 0) return "维度不能为负数";
    if (this.dimension > MAX_VECTOR_DIMENSION) return `维度不能超过 ${MAX_VECTOR_DIMENSION}`;
    return null;
  }

  driverValue(value: unknown): string {
    const vec = Array.isArray(value) ? value : [];
    return JSON.stringify(vec);
  }
}

registerField("vector", (opts) => new VectorField(opts));
