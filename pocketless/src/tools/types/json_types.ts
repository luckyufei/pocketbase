/**
 * JSON 集合类型 — JSONArray, JSONMap, JSONRaw, Vector
 * 与 Go 版 types 包对齐
 */

/** JSONArray — JSON 数组封装 */
export class JSONArray<T = unknown> {
  private items: T[];

  constructor(items?: T[]) {
    this.items = items ? [...items] : [];
  }

  get(): T[] {
    return [...this.items];
  }

  set(items: T[]): void {
    this.items = [...items];
  }

  length(): number {
    return this.items.length;
  }

  toJSON(): T[] {
    return this.items;
  }

  static fromJSON<T>(data: unknown): JSONArray<T> {
    if (Array.isArray(data)) return new JSONArray<T>(data);
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return new JSONArray<T>(parsed);
      } catch {
        // 忽略解析失败
      }
    }
    return new JSONArray<T>();
  }
}

/** JSONMap — JSON 对象封装 */
export class JSONMap<T = unknown> {
  private data: Record<string, T>;

  constructor(data?: Record<string, T>) {
    this.data = data ? { ...data } : {};
  }

  get(key: string): T | undefined {
    return this.data[key];
  }

  set(key: string, value: T): void {
    this.data[key] = value;
  }

  has(key: string): boolean {
    return key in this.data;
  }

  delete(key: string): void {
    delete this.data[key];
  }

  keys(): string[] {
    return Object.keys(this.data);
  }

  toJSON(): Record<string, T> {
    return { ...this.data };
  }

  static fromJSON<T>(data: unknown): JSONMap<T> {
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return new JSONMap<T>(data as Record<string, T>);
    }
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return new JSONMap<T>(parsed);
        }
      } catch {
        // 忽略解析失败
      }
    }
    return new JSONMap<T>();
  }
}

/** JSONRaw — 原始 JSON 值（不做类型转换） */
export class JSONRaw {
  private value: unknown;

  constructor(value?: unknown) {
    this.value = value ?? null;
  }

  get(): unknown {
    return this.value;
  }

  set(value: unknown): void {
    this.value = value;
  }

  toJSON(): unknown {
    return this.value;
  }

  toString(): string {
    return JSON.stringify(this.value);
  }

  static fromJSON(data: unknown): JSONRaw {
    if (typeof data === "string") {
      try {
        return new JSONRaw(JSON.parse(data));
      } catch {
        return new JSONRaw(data);
      }
    }
    return new JSONRaw(data);
  }
}

/** Vector — 向量类型（用于向量搜索） */
export class Vector {
  private values: number[];

  constructor(values?: number[]) {
    this.values = values ? [...values] : [];
  }

  get(): number[] {
    return [...this.values];
  }

  set(values: number[]): void {
    this.values = [...values];
  }

  dimension(): number {
    return this.values.length;
  }

  toJSON(): number[] {
    return this.values;
  }

  /** PostgreSQL pgvector 格式: [1,2,3] */
  toPgVector(): string {
    return `[${this.values.join(",")}]`;
  }

  static fromJSON(data: unknown): Vector {
    if (Array.isArray(data)) {
      return new Vector(data.map(Number));
    }
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return new Vector(parsed.map(Number));
      } catch {
        // 处理 pgvector 格式 [1,2,3]
        const cleaned = data.replace(/[\[\]]/g, "");
        if (cleaned) {
          return new Vector(cleaned.split(",").map(Number));
        }
      }
    }
    return new Vector();
  }
}
