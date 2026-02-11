/**
 * DBAdapter 接口 — 抽象 SQLite/PostgreSQL 差异
 * 与 Go 版 core.DBAdapter 对齐
 */

export interface DBAdapter {
  /** 数据库类型 */
  type(): "sqlite" | "postgres";

  /** 将数据库值转换为 boolean */
  boolValue(val: unknown): boolean;

  /** 格式化 boolean 用于 SQL 参数 */
  formatBool(val: boolean): unknown;

  /** 格式化时间用于 SQL 参数 */
  formatTime(val: Date): string;

  /** JSON 字段提取（SQLite: JSON_EXTRACT, PG: ->> ） */
  jsonExtract(column: string, path: string): string;

  /** JSON 数组长度（SQLite: JSON_ARRAY_LENGTH, PG: jsonb_array_length） */
  jsonArrayLength(column: string): string;

  /** 不区分大小写排序规则 */
  noCaseCollation(): string;

  /** 检测唯一键冲突错误 */
  isUniqueViolation(err: Error): boolean;

  /** 检测外键约束错误 */
  isForeignKeyViolation(err: Error): boolean;

  /** 获取底层数据库连接 */
  rawDB(): unknown;

  /** 关闭连接 */
  close(): Promise<void>;

  /** 执行 SQL（写操作） */
  exec(sql: string, ...params: unknown[]): void;

  /** 查询 SQL（读操作） */
  query<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[];

  /** 查询单行 */
  queryOne<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | null;
}
