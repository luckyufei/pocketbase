/**
 * TraceDetail 组件
 * Trace 详情面板，包含瀑布图
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Loader2,
  X,
  ChevronRight,
  ChevronDown,
  Check,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getApiClient } from '@/lib/ApiClient'
import type { TraceEntry } from '../store'
import {
  formatDuration,
  getStatusColor,
  getStatusBarColor,
  buildSpanHierarchy,
  flattenSpanHierarchy,
  getSpanBarStyle,
  type Span,
  type SpanNode,
} from '@/lib/traceUtils'

interface TraceDetailProps {
  trace: TraceEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TraceDetail({ trace, open, onOpenChange }: TraceDetailProps) {
  const [spans, setSpans] = useState<Span[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // 加载 Trace 详情
  useEffect(() => {
    if (!trace || !open) return

    const loadDetails = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const pb = getApiClient()
        const response = await pb.send(`/api/traces/${trace.id}`, {
          method: 'GET',
        })
        setSpans(response.items || [])
        // 默认展开所有
        const allIds = new Set((response.items || []).map((s: Span) => s.span_id))
        setExpandedIds(allIds)
      } catch (err: any) {
        setError(err.message || '加载 Trace 详情失败')
      } finally {
        setIsLoading(false)
      }
    }

    loadDetails()
  }, [trace, open])

  // 构建层级
  const hierarchy = useMemo(() => {
    return buildSpanHierarchy(spans)
  }, [spans])

  // 扁平化显示
  const flatSpans = useMemo(() => {
    return flattenSpanHierarchy(hierarchy.rootSpans, expandedIds)
  }, [hierarchy.rootSpans, expandedIds])

  // 切换展开
  const toggleExpand = useCallback((spanId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(spanId)) {
        next.delete(spanId)
      } else {
        next.add(spanId)
      }
      return next
    })
  }, [])

  // 关闭
  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  if (!trace) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Trace 详情</span>
          </DialogTitle>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>
              <strong>Trace ID:</strong>{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">{trace.id}</code>
            </div>
            <div>
              <strong>操作:</strong> {trace.method} {trace.url || '-'}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {error ? (
            <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
              <AlertTriangle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <span className="text-muted-foreground">加载 Trace 详情中...</span>
            </div>
          ) : spans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <HelpCircle className="h-12 w-12 mb-4 opacity-50" />
              <p>此 Trace 没有 Span 数据</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* 瀑布图头部 */}
              <div className="flex items-center justify-between py-3 border-b">
                <h3 className="font-medium">调用链瀑布图</h3>
                <div className="text-sm text-muted-foreground">
                  总耗时: {formatDuration(hierarchy.totalDuration * 1000)} | Span 数量:{' '}
                  {spans.length}
                </div>
              </div>

              {/* 时间轴 */}
              <div className="flex items-center py-2 border-b text-xs text-muted-foreground">
                <div className="w-[200px] shrink-0" />
                <div className="flex-1 flex justify-between px-4">
                  <span>0ms</span>
                  <span>{formatDuration(hierarchy.totalDuration * 1000)}</span>
                </div>
              </div>

              {/* Span 列表 */}
              <ScrollArea className="flex-1">
                <div className="py-2">
                  {flatSpans.map((span) => (
                    <SpanRow
                      key={span.span_id}
                      span={span}
                      isExpanded={expandedIds.has(span.span_id)}
                      onToggle={toggleExpand}
                      minStartTime={hierarchy.minStartTime}
                      totalDuration={hierarchy.totalDuration}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            <X className="mr-2 h-4 w-4" />
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Span 行组件
interface SpanRowProps {
  span: SpanNode
  isExpanded: boolean
  onToggle: (spanId: string) => void
  minStartTime: number
  totalDuration: number
}

function SpanRow({ span, isExpanded, onToggle, minStartTime, totalDuration }: SpanRowProps) {
  const barStyle = useMemo(
    () => getSpanBarStyle(span, minStartTime, totalDuration),
    [span, minStartTime, totalDuration]
  )

  const statusColor = getStatusColor(span.status)
  const barColor = getStatusBarColor(span.status)
  const hasChildren = span.children.length > 0

  // 状态图标
  const StatusIcon = useMemo(() => {
    switch (span.status) {
      case 'OK':
        return Check
      case 'ERROR':
        return AlertTriangle
      case 'CANCELLED':
        return X
      default:
        return HelpCircle
    }
  }, [span.status])

  return (
    <div className="border-b last:border-b-0" style={{ marginLeft: span.level * 20 }}>
      <div className="flex items-center py-2 hover:bg-muted/50">
        {/* Span 信息 */}
        <div className="w-[200px] shrink-0 flex items-center gap-2 text-sm">
          {hasChildren ? (
            <button className="p-0.5 hover:bg-muted rounded" onClick={() => onToggle(span.span_id)}>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          <span className="truncate font-medium" title={span.name}>
            {span.name}
          </span>

          <span className="text-xs text-muted-foreground font-mono">
            {formatDuration(span.duration)}
          </span>

          <span
            className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium',
              statusColor
            )}
          >
            <StatusIcon className="h-2.5 w-2.5" />
            {span.status}
          </span>
        </div>

        {/* 时间条 */}
        <div className="flex-1 relative h-5 bg-muted rounded mx-4">
          <div
            className={cn('absolute top-0.5 bottom-0.5 rounded', barColor)}
            style={{ left: barStyle.left, width: barStyle.width }}
          />
        </div>
      </div>

      {/* 属性展示 */}
      {span.attributes && Object.keys(span.attributes).length > 0 && (
        <div className="ml-6 mb-2 p-2 bg-muted/50 rounded text-xs">
          {Object.entries(span.attributes).map(([key, value]) => (
            <div key={key} className="flex gap-2 mb-0.5 last:mb-0">
              <span className="text-muted-foreground min-w-[100px]">{key}:</span>
              <span className="break-all">{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
