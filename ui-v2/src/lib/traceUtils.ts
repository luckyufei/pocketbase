/**
 * Trace Utils
 * Trace 相关工具函数
 */

/**
 * Span 数据类型
 */
export interface Span {
  span_id: string
  parent_id: string | null
  name: string
  start_time: string
  duration: number // 微秒
  status: string
  attributes: Record<string, unknown>
}

/**
 * Span 节点（带层级信息）
 */
export interface SpanNode extends Span {
  children: SpanNode[]
  level: number
}

/**
 * 层级构建结果
 */
export interface SpanHierarchyResult {
  rootSpans: SpanNode[]
  totalDuration: number
  minStartTime: number
}

/**
 * 格式化持续时间（微秒）
 */
export function formatDuration(microseconds: number | null | undefined): string {
  if (microseconds === null || microseconds === undefined) return '-'

  const ms = microseconds / 1000
  if (ms < 1) {
    return `${microseconds}μs`
  } else if (ms < 1000) {
    return `${ms.toFixed(1)}ms`
  } else {
    return `${(ms / 1000).toFixed(2)}s`
  }
}

/**
 * 获取状态类名
 */
export function getStatusClass(status: string): string {
  switch (status) {
    case 'OK':
      return 'status-success'
    case 'ERROR':
      return 'status-error'
    case 'CANCELLED':
      return 'status-cancelled'
    default:
      return 'status-unknown'
  }
}

/**
 * 获取状态颜色（Tailwind 类）
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'OK':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'ERROR':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

/**
 * 获取状态图标名称
 */
export function getStatusIcon(status: string): string {
  switch (status) {
    case 'OK':
      return 'check'
    case 'ERROR':
      return 'alert-triangle'
    case 'CANCELLED':
      return 'x'
    default:
      return 'help-circle'
  }
}

/**
 * 获取状态条颜色
 */
export function getStatusBarColor(status: string): string {
  switch (status) {
    case 'OK':
      return 'bg-green-500'
    case 'ERROR':
      return 'bg-red-500'
    case 'CANCELLED':
      return 'bg-gray-400'
    default:
      return 'bg-gray-400'
  }
}

/**
 * 构建 Span 层级结构
 */
export function buildSpanHierarchy(spans: Span[]): SpanHierarchyResult {
  if (spans.length === 0) {
    return {
      rootSpans: [],
      totalDuration: 0,
      minStartTime: 0,
    }
  }

  // 计算时间范围
  const startTimes = spans.map((s) => new Date(s.start_time).getTime())
  const endTimes = spans.map((s) => new Date(s.start_time).getTime() + s.duration / 1000)

  const minStartTime = Math.min(...startTimes)
  const maxEndTime = Math.max(...endTimes)
  const totalDuration = maxEndTime - minStartTime

  // 构建 Map
  const spanMap = new Map<string, SpanNode>()
  spans.forEach((span) => {
    spanMap.set(span.span_id, { ...span, children: [], level: 0 })
  })

  // 构建父子关系
  const rootSpans: SpanNode[] = []
  spans.forEach((span) => {
    const spanNode = spanMap.get(span.span_id)!
    if (span.parent_id && spanMap.has(span.parent_id)) {
      const parent = spanMap.get(span.parent_id)!
      parent.children.push(spanNode)
      spanNode.level = parent.level + 1
    } else {
      rootSpans.push(spanNode)
    }
  })

  return {
    rootSpans,
    totalDuration,
    minStartTime,
  }
}

/**
 * 扁平化 Span 层级（用于显示）
 */
export function flattenSpanHierarchy(rootSpans: SpanNode[], expandedIds: Set<string>): SpanNode[] {
  const result: SpanNode[] = []

  function flatten(spans: SpanNode[], level: number) {
    spans.forEach((span) => {
      span.level = level
      result.push(span)
      if (expandedIds.has(span.span_id) && span.children.length > 0) {
        flatten(span.children, level + 1)
      }
    })
  }

  flatten(rootSpans, 0)
  return result
}

/**
 * 计算 Span 条的样式
 */
export function getSpanBarStyle(
  span: Span,
  minStartTime: number,
  totalDuration: number
): { left: string; width: string } {
  if (totalDuration === 0) {
    return { left: '0%', width: '100%' }
  }

  const startTime = new Date(span.start_time).getTime()
  const duration = span.duration / 1000 // 转换为毫秒

  const leftPercent = ((startTime - minStartTime) / totalDuration) * 100
  const widthPercent = Math.max((duration / totalDuration) * 100, 0.5)

  return {
    left: `${leftPercent}%`,
    width: `${widthPercent}%`,
  }
}
