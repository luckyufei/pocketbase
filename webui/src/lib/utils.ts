import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 截断字符串
 */
export function truncate(
  str: string,
  maxLength: number = 100,
  addEllipsis: boolean = false
): string {
  if (!str || str.length <= maxLength) return str
  return str.substring(0, maxLength) + (addEllipsis ? '...' : '')
}

/**
 * 截断对象属性值
 */
export function truncateObject(
  obj: Record<string, unknown>,
  maxLength: number = 100
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key in obj) {
    const value = obj[key]
    if (typeof value === 'string') {
      result[key] = truncate(value, maxLength)
    } else if (typeof value === 'object' && value !== null) {
      result[key] = '[Object]'
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * 将值转换为数组
 */
export function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * 检查值是否为空
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * 从 HTML 中提取纯文本
 */
export function plainText(html: string): string {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

/**
 * 从 SQL 查询中提取列名
 */
export function extractColumnsFromQuery(query: string): string[] {
  if (!query) return []

  // 简单的 SELECT 列提取
  const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i)
  if (!selectMatch) return []

  const columnsStr = selectMatch[1]
  const columns: string[] = []

  // 处理 AS 别名
  const parts = columnsStr.split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    const asMatch = trimmed.match(/\s+(?:AS\s+)?(\w+)$/i)
    if (asMatch) {
      columns.push(asMatch[1])
    } else {
      // 简单列名
      const simpleMatch = trimmed.match(/^(\w+)$/)
      if (simpleMatch) {
        columns.push(simpleMatch[1])
      }
    }
  }

  return columns
}

/**
 * 将字符串转换为句子格式（首字母大写）
 */
export function sentenize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Image extensions
const imageExtensions = ['jpg', 'jpeg', 'png', 'svg', 'gif', 'webp', 'avif']

// Document extensions
const documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'txt', 'rtf', 'csv', 'json', 'xml', 'html', 'htm', 'md']

// Video extensions
const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'mpeg', 'mpg', '3gp', 'm4v']

// Audio extensions
const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'wma', 'm4a', 'opus']

/**
 * 获取文件扩展名（小写）
 */
export function getFileExtension(filename: string): string {
  if (!filename) return ''
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : ''
}

/**
 * 检查是否为图片扩展名
 */
export function hasImageExtension(filename: string): boolean {
  const ext = getFileExtension(filename)
  return imageExtensions.includes(ext)
}

/**
 * 获取文件类型
 */
export function getFileType(filename: string): 'image' | 'document' | 'video' | 'audio' | 'file' {
  const ext = getFileExtension(filename)
  
  if (imageExtensions.includes(ext)) return 'image'
  if (documentExtensions.includes(ext)) return 'document'
  if (videoExtensions.includes(ext)) return 'video'
  if (audioExtensions.includes(ext)) return 'audio'
  
  return 'file'
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}
