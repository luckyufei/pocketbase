/**
 * 字段修饰符 — 与 Go 版 core/record_field_resolver.go 对齐
 *
 * 修饰符通过 `:` 附加在字段路径末尾:
 *   :isset   — 字段是否存在/非 NULL
 *   :changed — 字段是否变更（仅在 update 上下文中有意义）
 *   :length  — 多值字段的数组长度
 *   :each    — 遍历多值字段的每个元素
 *   :lower   — 小写化
 */

export type Modifier = "isset" | "changed" | "length" | "each" | "lower";

export const knownModifiers: Modifier[] = ["isset", "changed", "length", "each", "lower"];

/**
 * 从字段路径中提取修饰符
 * @returns [cleanPath, modifiers]
 *
 * 例如: "tags:length" → ["tags", ["length"]]
 *       "name:lower"  → ["name", ["lower"]]
 *       "tags:each:lower" → ["tags", ["each", "lower"]]
 */
export function extractModifiers(fieldPath: string): [string, Modifier[]] {
  const parts = fieldPath.split(":");
  const modifiers: Modifier[] = [];
  let cleanParts: string[] = [parts[0]];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i] as Modifier;
    if (knownModifiers.includes(part)) {
      modifiers.push(part);
    } else {
      // 不是修饰符，可能是标识符的一部分（例如 @collection:alias.field）
      cleanParts.push(parts[i]);
    }
  }

  return [cleanParts.join(":"), modifiers];
}

/**
 * 应用 :length 修饰符到 SQL 表达式
 */
export function applyLengthModifier(
  identifier: string,
  dbType: "sqlite" | "postgres",
): string {
  if (dbType === "postgres") {
    return `jsonb_array_length(${identifier})`;
  }
  return `JSON_ARRAY_LENGTH(${identifier})`;
}

/**
 * 应用 :lower 修饰符到 SQL 表达式
 */
export function applyLowerModifier(identifier: string): string {
  return `LOWER(${identifier})`;
}

/**
 * 应用 :isset 修饰符 — 生成 IS NOT NULL 表达式
 */
export function applyIssetModifier(identifier: string): string {
  return `(${identifier} IS NOT NULL AND ${identifier} != '')`;
}
