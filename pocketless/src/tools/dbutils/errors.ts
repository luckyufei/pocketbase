/**
 * T022 — tools/dbutils/errors.ts
 * DB 错误分类工具
 */

export function isUniqueViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed/i.test(msg) || /duplicate key/i.test(msg) || /unique_violation/i.test(msg);
}

export function isForeignKeyViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /FOREIGN KEY constraint failed/i.test(msg) || /foreign_key_violation/i.test(msg);
}

export function isNotNullViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /NOT NULL constraint failed/i.test(msg) || /not_null_violation/i.test(msg);
}
