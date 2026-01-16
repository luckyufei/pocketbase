/**
 * Trace 列表
 * 显示 Trace ID、操作名称、状态、时间、耗时、Spans 数量
 */
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, ChevronLeft, ChevronRight, Check, X, AlertCircle } from 'lucide-react'
import type { Span, SpanStatus } from '../store'

interface Props {
  traces: Span[]
  isLoading: boolean
  currentPage: number
  totalItems: number
  perPage: number
  totalPages: number
  activeTraceId: string | null
  onTraceSelect: (traceId: string) => void
  onPageChange: (page: number) => void
}

/**
 * 格式化时间戳（微秒 -> 日期时间）
 */
function formatTimestamp(microseconds: number): string {
  const date = new Date(microseconds / 1000)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * 格式化延迟（微秒 -> 可读格式）
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
 * 状态图标
 */
function StatusIcon({ status }: { status: SpanStatus }) {
  switch (status) {
    case 'OK':
      return <Check className="w-3.5 h-3.5" />
    case 'ERROR':
      return <X className="w-3.5 h-3.5" />
    case 'CANCELLED':
      return <AlertCircle className="w-3.5 h-3.5" />
    default:
      return null
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
    <Badge variant="secondary" className={`${styles[status]} text-xs gap-1`}>
      <StatusIcon status={status} />
      {status}
    </Badge>
  )
}

/**
 * 分页页码
 */
function getPageNumbers(currentPage: number, totalPages: number): number[] {
  const pages: number[] = []
  const maxVisible = 5
  
  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
  } else {
    const start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
  }
  
  return pages
}

export function TraceList({
  traces,
  isLoading,
  currentPage,
  totalItems,
  perPage,
  totalPages,
  activeTraceId,
  onTraceSelect,
  onPageChange,
}: Props) {
  if (isLoading && traces.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (traces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <AlertCircle className="w-10 h-10 mb-3 opacity-50" />
        <p>没有找到符合条件的 Trace 记录</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* 加载遮罩 */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}

      {/* 表格 */}
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/50">
            <TableHead className="w-24 text-xs">Trace ID</TableHead>
            <TableHead className="text-xs">操作名称</TableHead>
            <TableHead className="w-20 text-xs">状态</TableHead>
            <TableHead className="w-32 text-xs">开始时间</TableHead>
            <TableHead className="w-20 text-xs text-right">耗时</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {traces.map((trace) => (
            <TableRow
              key={trace.trace_id + trace.span_id}
              className={`cursor-pointer transition-colors ${
                activeTraceId === trace.trace_id
                  ? 'bg-blue-50 hover:bg-blue-50'
                  : 'hover:bg-slate-50'
              }`}
              onClick={() => onTraceSelect(trace.trace_id)}
            >
              <TableCell className="py-2">
                <code className="text-xs font-mono text-slate-600">
                  {trace.trace_id.slice(0, 8)}...
                </code>
              </TableCell>
              <TableCell className="py-2">
                <span className="text-sm text-slate-900 truncate block max-w-md" title={trace.name}>
                  {trace.name || '-'}
                </span>
              </TableCell>
              <TableCell className="py-2">
                <StatusBadge status={trace.status} />
              </TableCell>
              <TableCell className="py-2 text-xs text-slate-500">
                {formatTimestamp(trace.start_time)}
              </TableCell>
              <TableCell className="py-2 text-xs font-mono text-slate-600 text-right">
                {formatDuration(trace.duration)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-1 py-3 border-t border-slate-100">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          {getPageNumbers(currentPage, totalPages).map((page) => (
            <Button
              key={page}
              variant={page === currentPage ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onPageChange(page)}
              className={`h-7 w-7 p-0 text-xs ${
                page === currentPage ? 'bg-blue-500 hover:bg-blue-600' : ''
              }`}
            >
              {page}
            </Button>
          ))}

          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
