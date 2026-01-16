/**
 * TraceList 组件
 * Trace 列表，支持分页和选择
 */
import { useCallback, useMemo } from 'react'
import {
  Loader2,
  Check,
  AlertTriangle,
  X,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTraces } from '../hooks/useTraces'
import type { TraceEntry } from '../store'
import { formatDuration, getStatusColor } from '@/lib/traceUtils'
import dayjs from 'dayjs'

interface TraceListProps {
  onSelect?: (trace: TraceEntry) => void
  className?: string
}

export function TraceList({ onSelect, className }: TraceListProps) {
  const { traces, isLoading, currentPage, hasMore, loadTraces } = useTraces()

  // 计算总页数（简化版，实际应从 API 获取）
  const totalPages = useMemo(() => {
    return hasMore ? currentPage + 1 : currentPage
  }, [currentPage, hasMore])

  // 分页处理
  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page !== currentPage) {
        loadTraces(page, false)
      }
    },
    [currentPage, loadTraces]
  )

  // 行点击
  const handleRowClick = useCallback(
    (trace: TraceEntry) => {
      onSelect?.(trace)
    },
    [onSelect]
  )

  // 获取页码列表
  const pageNumbers = useMemo(() => {
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
  }, [currentPage, totalPages])

  return (
    <div className={cn('relative flex flex-col rounded-lg border bg-card', className)}>
      {/* 加载遮罩 */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {/* 空状态 */}
      {traces.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <HelpCircle className="h-12 w-12 mb-4 opacity-50" />
          <p>没有找到符合条件的 Trace 记录</p>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Trace ID</TableHead>
                  <TableHead>操作名称</TableHead>
                  <TableHead className="w-[90px]">状态</TableHead>
                  <TableHead className="w-[150px]">开始时间</TableHead>
                  <TableHead className="w-[80px]">耗时</TableHead>
                  <TableHead className="w-[60px] text-center">Spans</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {traces.map((trace) => (
                  <TraceRow key={trace.id} trace={trace} onClick={handleRowClick} />
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-3 border-t">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex gap-1">
                {pageNumbers.map((page) => (
                  <Button
                    key={page}
                    variant={page === currentPage ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </Button>
                ))}
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Trace 行组件
interface TraceRowProps {
  trace: TraceEntry
  onClick: (trace: TraceEntry) => void
}

function TraceRow({ trace, onClick }: TraceRowProps) {
  const statusColor = getStatusColor(trace.status?.toString() || 'UNKNOWN')

  // 获取状态图标
  const StatusIcon = useMemo(() => {
    switch (trace.status) {
      case 200:
      case 'OK':
        return Check
      case 'ERROR':
      case 500:
        return AlertTriangle
      case 'CANCELLED':
        return X
      default:
        return HelpCircle
    }
  }, [trace.status])

  // 格式化时间
  const formattedTime = useMemo(() => {
    return dayjs(trace.created).format('YYYY-MM-DD HH:mm:ss')
  }, [trace.created])

  return (
    <TableRow className="cursor-pointer" onClick={() => onClick(trace)}>
      <TableCell>
        <code className="text-xs font-mono">{trace.id.slice(0, 8)}...</code>
      </TableCell>
      <TableCell className="truncate max-w-[300px]" title={trace.url}>
        {trace.method} {trace.url || '-'}
      </TableCell>
      <TableCell>
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
            statusColor
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {trace.status}
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{formattedTime}</TableCell>
      <TableCell className="font-mono text-sm">{formatDuration(trace.execTime * 1000)}</TableCell>
      <TableCell className="text-center">{(trace.data as any)?.span_count || 1}</TableCell>
    </TableRow>
  )
}
