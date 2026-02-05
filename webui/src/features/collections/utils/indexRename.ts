/**
 * 索引重命名工具函数
 * Phase 5: Collection 重命名时自动更新索引中的表名
 */

/**
 * 更新索引中的表名
 * @param indexes 索引定义数组
 * @param oldName 旧表名
 * @param newName 新表名
 * @returns 更新后的索引数组
 */
export function updateIndexTableName(
  indexes: string[],
  oldName: string,
  newName: string
): string[] {
  if (oldName === newName || !oldName || !newName) {
    return indexes
  }
  
  return indexes.map(idx => {
    // 索引格式示例: CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`)
    // 需要更新 ON `oldName` 为 ON `newName`
    return idx.replace(
      new RegExp(`\\bON\\s+\`${escapeRegExp(oldName)}\``, 'gi'),
      `ON \`${newName}\``
    ).replace(
      // 同时更新索引名中的表名部分 (如果存在)
      new RegExp(`idx_${escapeRegExp(oldName)}_`, 'gi'),
      `idx_${newName}_`
    )
  })
}

/**
 * 更新索引中的字段名
 * @param indexes 索引定义数组
 * @param oldFieldName 旧字段名
 * @param newFieldName 新字段名
 * @returns 更新后的索引数组
 */
export function updateIndexFieldName(
  indexes: string[],
  oldFieldName: string,
  newFieldName: string
): string[] {
  if (oldFieldName === newFieldName || !oldFieldName || !newFieldName) {
    return indexes
  }
  
  return indexes.map(idx => {
    // 更新索引定义中的字段名引用
    // 例如: (`email`, `username`) -> (`new_email`, `username`)
    return idx.replace(
      new RegExp(`\`${escapeRegExp(oldFieldName)}\``, 'g'),
      `\`${newFieldName}\``
    ).replace(
      // 同时更新索引名中的字段名部分 (如果存在)
      new RegExp(`_${escapeRegExp(oldFieldName)}([_\`]|$)`, 'g'),
      `_${newFieldName}$1`
    )
  })
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 从索引定义中解析表名
 * @param indexDef 索引定义字符串
 * @returns 表名或 null
 */
export function parseTableNameFromIndex(indexDef: string): string | null {
  const match = indexDef.match(/ON\s+`([^`]+)`/i)
  return match ? match[1] : null
}

/**
 * 从索引定义中解析索引名
 * @param indexDef 索引定义字符串
 * @returns 索引名或 null
 */
export function parseIndexName(indexDef: string): string | null {
  const match = indexDef.match(/(?:INDEX|KEY)\s+`([^`]+)`/i)
  return match ? match[1] : null
}

/**
 * 从索引定义中解析字段列表
 * @param indexDef 索引定义字符串
 * @returns 字段名数组
 */
export function parseIndexFields(indexDef: string): string[] {
  // 匹配 ON `table` 后面括号中的字段
  const match = indexDef.match(/ON\s+`[^`]+`\s*\(([^)]+)\)/i)
  if (!match) return []
  
  // 解析字段列表
  const fieldsStr = match[1]
  const fieldMatches = fieldsStr.match(/`([^`]+)`/g)
  if (!fieldMatches) return []
  
  return fieldMatches.map(f => f.replace(/`/g, ''))
}
