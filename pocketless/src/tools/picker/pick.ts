/**
 * Picker — JSON 字段选择器
 * 与 Go 版 tools/picker/pick.go 对齐
 *
 * 从 map/数组中选择指定字段，支持嵌套 dot-notation 和 * 通配符
 */

/**
 * 从数据中选择指定字段
 *
 * @param data - 输入数据（对象、数组、或其他）
 * @param rawFields - 逗号分隔的字段列表，支持 dot-notation 嵌套
 * @returns 仅包含指定字段的数据
 *
 * @example
 * pick({ a: 1, b: 2, c: { c1: 11, c2: 22 } }, "a,c.c1")
 * // => { a: 1, c: { c1: 11 } }
 */
export function pick(data: any, rawFields: string): any {
  if (data === null || data === undefined) return data;

  const fields = parseFields(rawFields);

  // 如果 fields 为空，返回原数据
  if (Object.keys(fields).length === 0) return data;

  // 深拷贝数据以避免修改原始数据
  const cloned = JSON.parse(JSON.stringify(data));

  pickParsedFields(cloned, fields);
  return cloned;
}

/**
 * 解析逗号分隔的字段字符串为字段映射
 */
function parseFields(rawFields: string): Record<string, null> {
  if (!rawFields || rawFields.trim() === "") return {};

  const result: Record<string, null> = {};

  const parts = rawFields.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) {
      result[trimmed] = null;
    }
  }

  return result;
}

/**
 * 递归过滤数据
 */
function pickParsedFields(data: any, fields: Record<string, null>): void {
  if (Array.isArray(data)) {
    if (data.length === 0) return;
    if (typeof data[0] !== "object" || data[0] === null) return;

    for (const item of data) {
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        pickMapFields(item as Record<string, any>, fields);
      }
    }
    return;
  }

  if (typeof data === "object" && data !== null) {
    pickMapFields(data as Record<string, any>, fields);
  }
}

/**
 * 过滤 map 中的字段
 */
function pickMapFields(data: Record<string, any>, fields: Record<string, null>): void {
  if (Object.keys(fields).length === 0) return;

  // 处理 * 通配符：将所有根级别 key 添加到 fields 中
  if ("*" in fields) {
    for (const k of Object.keys(data)) {
      let exists = false;
      for (const f of Object.keys(fields)) {
        if (f === "*") continue;
        if ((f + ".").startsWith(k + ".")) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        fields[k] = null;
      }
    }
  }

  // 遍历数据中的每个 key
  const keysToDelete: string[] = [];

  for (const k of Object.keys(data)) {
    // 查找匹配的字段
    const matchingFields: Record<string, null> = {};
    for (const f of Object.keys(fields)) {
      if ((f + ".").startsWith(k + ".")) {
        matchingFields[f] = null;
      }
    }

    if (Object.keys(matchingFields).length === 0) {
      keysToDelete.push(k);
      continue;
    }

    // 检查是否为精确匹配（即当前 key 就是最终字段）
    let isExactMatch = false;
    for (const f of Object.keys(matchingFields)) {
      const remains = (f + ".").slice((k + ".").length).replace(/\.$/, "");
      if (remains === "") {
        isExactMatch = true;
        break;
      }
    }

    if (isExactMatch) {
      continue; // 保留这个字段
    }

    // 还有子路径需要递归处理
    const subFields: Record<string, null> = {};
    for (const f of Object.keys(matchingFields)) {
      const remains = (f + ".").slice((k + ".").length).replace(/\.$/, "");
      if (remains) {
        subFields[remains] = null;
      }
    }

    if (Object.keys(subFields).length > 0) {
      pickParsedFields(data[k], subFields);
    }
  }

  // 删除不匹配的 key
  for (const k of keysToDelete) {
    delete data[k];
  }
}
