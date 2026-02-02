/**
 * Trace 详情面板
 * 瀑布图展示 Spans 调用链
 */
import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
import type { Span, SpanStatus } from '../store'

interface Props {
  traceId: string | null
  spans: Span[]
  isLoading: boolean
  onClose: () => void
}

interface SpanNode extends Span {
  children: SpanNode[]
  level: number
}

/**
 * 格式化延迟
 */
function formatDuration(microseconds: number | null | undefined): string {
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
 * 获取状态样式
 */
function getStatusStyle(status: SpanStatus): string {
  switch (status) {
    case 'OK':
      return 'bg-blue-500'
    case 'ERROR':
      return 'bg-red-500'
    case 'CANCELLED':
      return 'bg-slate-400'
    default:
      return 'bg-slate-300'
  }
}

/**
 * 状态徽章
 */
function StatusBadge({ status }: { status: SpanStatus }) {
  const styles: Record<SpanStatus, string> = {
    OK: 'bg-blue-100 text-blue-700',
    ERROR: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-slate-100 text-slate-600',
    UNSET: 'bg-slate-100 text-slate-500',
  }

  return (
    <Badge variant="secondary" className={`${styles[status]} text-[10px] px-1.5 py-0`}>
      {status}
    </Badge>
  )
}

/**
 * 单个 Span 行
 */
function SpanRow({
  span,
  isExpanded,
  hasChildren,
  onToggle,
  minStartTime,
  totalDuration,
}: {
  span: SpanNode
  isExpanded: boolean
  hasChildren: boolean
  onToggle: () => void
  minStartTime: number
  totalDuration: number
}) {
  const leftPercent = ((span.start_time - minStartTime) / totalDuration) * 100
  const widthPercent = (span.duration / totalDuration) * 100

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <div className="flex items-center py-2" style={{ marginLeft: `${span.level * 16}px` }}>
        {/* 展开按钮 */}
        <div className="w-5 flex-shrink-0">
          {hasChildren && (
            <button
              type="button"
              onClick={onToggle}
              className="text-slate-400 hover:text-slate-600"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Span 信息 */}
        <div className="w-48 flex-shrink-0 flex items-center gap-2 pr-2">
          <span className="text-xs text-slate-900 truncate flex-1" title={span.name}>
            {span.name}
          </span>
          <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
            {formatDuration(span.duration)}
          </span>
          <StatusBadge status={span.status} />
        </div>

        {/* 瀑布图时间条 */}
        <div className="flex-1 relative h-5 bg-slate-100 rounded-sm mx-2">
          <div
            className={`absolute top-0.5 bottom-0.5 rounded-sm ${getStatusStyle(span.status)}`}
            style={{
              left: `${leftPercent}%`,
              width: `${Math.max(widthPercent, 0.5)}%`,
            }}
          />
        </div>
      </div>

      {/* 属性展示 */}
      {span.attributes && Object.keys(span.attributes).length > 0 && (
        <div className="ml-5 mr-4 mb-2 px-3 py-2 bg-slate-50 rounded text-xs" style={{ marginLeft: `${span.level * 16 + 20}px` }}>
          {Object.entries(span.attributes).map(([key, value]) => (
            <div key={key} className="flex gap-2 py-0.5">
              <span className="text-slate-500 min-w-[100px]">{key}:</span>
              <span className="text-slate-700 break-all">{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function TraceDetail({ traceId, spans, isLoading, onClose }: Props) {
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set())

  // 构建层级结构
  const { spanHierarchy, minStartTime, totalDuration } = useMemo(() => {
    if (spans.length === 0) {
      return { spanHierarchy: [], minStartTime: 0, totalDuration: 1 }
    }

    // 计算时间范围
    const startTimes = spans.map(s => s.start_time)
    const endTimes = spans.map(s => s.start_time + s.duration)
    const minStart = Math.min(...startTimes)
    const maxEnd = Math.max(...endTimes)
    const total = maxEnd - minStart

    // 构建父子关系
    const spanMap = new Map<string, SpanNode>()
    spans.forEach(span => {
      spanMap.set(span.span_id, { ...span, children: [], level: 0 })
    })

    const rootSpans: SpanNode[] = []
    spans.forEach(span => {
      const spanNode = spanMap.get(span.span_id)!
      if (span.parent_id && spanMap.has(span.parent_id)) {
        const parent = spanMap.get(span.parent_id)!
        parent.children.push(spanNode)
        spanNode.level = parent.level + 1
      } else {
        rootSpans.push(spanNode)
      }
    })

    // 扁平化（考虑展开状态）
    const flattenSpans = (nodes: SpanNode[], level = 0): SpanNode[] => {
      const result: SpanNode[] = []
      nodes.forEach(node => {
        node.level = level
        result.push(node)
        if (expandedSpans.has(node.span_id) && node.children.length > 0) {
          result.push(...flattenSpans(node.children, level + 1))
        }
      })
      return result
    }

    return {
      spanHierarchy: flattenSpans(rootSpans),
      minStartTime: minStart,
      totalDuration: total || 1,
    }
  }, [spans, expandedSpans])

  const toggleSpan = (spanId: string) => {
    setExpandedSpans(prev => {
      const next = new Set(prev)
      if (next.has(spanId)) {
        next.delete(spanId)
      } else {
        next.add(spanId)
      }
      return next
    })
  }

  // 检查 span 是否有子节点
  const spanMap = useMemo(() => {
    const map = new Map<string, SpanNode>()
    spans.forEach(span => {
      map.set(span.span_id, { ...span, children: [], level: 0 })
    })
    spans.forEach(span => {
      if (span.parent_id && map.has(span.parent_id)) {
        map.get(span.parent_id)!.children.push(map.get(span.span_id)!)
      }
    })
    return map
  }, [spans])

  const hasChildren = (spanId: string) => {
    return (spanMap.get(spanId)?.children.length ?? 0) > 0
  }

  return (
    <div
      className={`fixed right-0 top-0 h-full w-[500px] bg-white border-l border-slate-200 shadow-xl transform transition-transform duration-300 ease-out z-20 ${
        traceId ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {traceId && (
        <div className="h-full flex flex-col">
          {/* 头部 */}
          <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 backdrop-blur-sm flex-shrink-0">
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-slate-900">Trace 详情</h3>
              <code className="text-xs text-slate-500 font-mono">{traceId}</code>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 flex-shrink-0">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* 内容 */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <span className="text-sm">加载 Trace 详情中...</span>
              </div>
            ) : spans.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <span className="text-sm">此 Trace 没有 Span 数据</span>
              </div>
            ) : (
              <>
                {/* 瀑布图头部 */}
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>总耗时: {formatDuration(totalDuration)}</span>
                    <span>Span 数量: {spans.length}</span>
                  </div>
                  {/* 时间轴 */}
                  <div className="flex justify-between text-[10px] text-slate-400 mt-2 ml-[calc(16px+12rem+0.5rem)] mr-2">
                    <span>0ms</span>
                    <span>{formatDuration(totalDuration)}</span>
                  </div>
                </div>

                {/* Span 列表 */}
                <div className="px-2">
                  {spanHierarchy.map(span => (
                    <SpanRow
                      key={span.span_id}
                      span={span}
                      isExpanded={expandedSpans.has(span.span_id)}
                      hasChildren={hasChildren(span.span_id)}
                      onToggle={() => toggleSpan(span.span_id)}
                      minStartTime={minStartTime}
                      totalDuration={totalDuration}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
