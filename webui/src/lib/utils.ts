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

/**
 * Task 6: Slugify 函数 - 与 UI 版本 CommonHelper.slugify 保持一致
 * 支持国际字符转换
 * 
 * @param str 输入字符串
 * @param delimiter 分隔符（默认 _）
 * @param preserved 保留的特殊字符
 */
export function slugify(str: string, delimiter = '_', preserved = ['.', '=', '-']): string {
  if (str === '') {
    return ''
  }

  // 特殊字符映射表 - 与 UI 版本保持一致
  const specialCharsMap: Record<string, RegExp> = {
    'a': /а|à|á|å|â/gi,
    'b': /б/gi,
    'c': /ц|ç/gi,
    'd': /д/gi,
    'e': /е|è|é|ê|ẽ|ë/gi,
    'f': /ф/gi,
    'g': /г/gi,
    'h': /х/gi,
    'i': /й|и|ì|í|î/gi,
    'j': /ж/gi,
    'k': /к/gi,
    'l': /л/gi,
    'm': /м/gi,
    'n': /н|ñ/gi,
    'o': /о|ò|ó|ô|ø/gi,
    'p': /п/gi,
    'q': /я/gi,
    'r': /р/gi,
    's': /с/gi,
    't': /т/gi,
    'u': /ю|ù|ú|ů|û/gi,
    'v': /в/gi,
    'w': /в/gi,
    'x': /ь/gi,
    'y': /ъ/gi,
    'z': /з/gi,
    'ae': /ä|æ/gi,
    'oe': /ö/gi,
    'ue': /ü/gi,
    'Ae': /Ä/gi,
    'Ue': /Ü/gi,
    'Oe': /Ö/gi,
    'ss': /ß/gi,
    'and': /&/gi,
  }

  // 替换特殊字符
  for (const k in specialCharsMap) {
    str = str.replace(specialCharsMap[k], k)
  }

  // 构建保留字符的正则表达式
  const preservedRegex = new RegExp('[' + preserved.map(c => '\\' + c).join('') + ']', 'g')

  return str
    .replace(preservedRegex, ' ')     // 将保留字符替换为空格
    .replace(/[^\w ]/gi, '')          // 移除所有非字母数字字符（保留空格）
    .replace(/\s+/g, delimiter)       // 将空格合并并替换为分隔符
    .toLowerCase()                     // 转换为小写
}
