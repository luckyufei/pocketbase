/**
 * 日期格式化工具函数
 */

/**
 * 格式化日期字符串为本地格式
 * @param dateStr - ISO 日期字符串
 * @returns 格式化后的日期字符串，如果输入为空则返回 "-"
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString()
}

/**
 * 格式化日期为短格式 (MM-DD)
 * @param date - Date 对象
 * @returns 格式化后的日期字符串 (MM-DD)
 */
export function formatShortDate(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${month}-${day}`
}

/**
 * 格式化相对时间
 * @param dateStr - ISO 日期字符串
 * @returns 相对时间描述，如 "2 分钟前"
 */
export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'

  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 7) return `${diffDays} 天前`

  return formatDate(dateStr)
}
