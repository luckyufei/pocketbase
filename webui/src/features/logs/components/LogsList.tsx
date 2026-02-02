/**
 * LogsList 组件
 * 日志列表，支持分页、过滤、批量选择
 */
import { useState, useCallback, useMemo } from 'react'
import { ArrowRight, Loader2, Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LogLevel } from './LogLevel'
import { LogDate } from './LogDate'
import { useLogs } from '../hooks/useLogs'
import type { LogEntry } from '../store'
import { extractLogPreviewKeys, stringifyValue, downloadLogAsJson } from '@/lib/logUtils'

interface LogsListProps {
  onSelect?: (log: LogEntry) => void
  className?: string
}

export function LogsList({ onSelect, className }: LogsListProps) {
  const { logs, isLoading, hasMore, filter, loadMore, setFilter } = useLogs()

  // 批量选择状态
  const [bulkSelected, setBulkSelected] = useState<Record<string, LogEntry>>({})

  const totalBulkSelected = Object.keys(bulkSelected).length
  const areAllLogsSelected = logs.length > 0 && totalBulkSelected === logs.length

  // 切换全选
  const toggleSelectAll = useCallback(() => {
    if (areAllLogsSelected) {
      setBulkSelected({})
    } else {
      const newSelected: Record<string, LogEntry> = {}
      for (const log of logs) {
        newSelected[log.id] = log
      }
      setBulkSelected(newSelected)
    }
  }, [areAllLogsSelected, logs])

  // 切换单个选择
  const toggleSelectLog = useCallback((log: LogEntry, e: React.MouseEvent) => {
    e.stopPropagation()
    setBulkSelected((prev) => {
      const newSelected = { ...prev }
      if (newSelected[log.id]) {
        delete newSelected[log.id]
      } else {
        newSelected[log.id] = log
      }
      return newSelected
    })
  }, [])

  // 取消全部选择
  const deselectAll = useCallback(() => {
    setBulkSelected({})
  }, [])

  // 下载选中的日志
  const downloadSelected = useCallback(() => {
    const selected = Object.values(bulkSelected)
    if (selected.length === 0) return
    downloadLogAsJson(selected)
  }, [bulkSelected])

  // 清除过滤器
  const clearFilter = useCallback(() => {
    setFilter('')
  }, [setFilter])

  // 处理行点击
  const handleRowClick = useCallback(
    (log: LogEntry) => {
      onSelect?.(log)
    },
    [onSelect]
  )

  // 处理键盘事件
  const handleRowKeyDown = useCallback(
    (log: LogEntry, e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onSelect?.(log)
      }
    },
    [onSelect]
  )

  return (
    <div className={cn('relative', className)}>
      <ScrollArea className="h-[calc(100vh-300px)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Checkbox
                    checked={areAllLogsSelected}
                    disabled={logs.length === 0}
                    onCheckedChange={toggleSelectAll}
                  />
                )}
              </TableHead>
              <TableHead className="w-[100px]">
                <div className="flex items-center gap-1">
                  <span>级别</span>
                </div>
              </TableHead>
              <TableHead className="min-w-[400px]">
                <div className="flex items-center gap-1">
                  <span>消息</span>
                </div>
              </TableHead>
              <TableHead className="w-[220px]">
                <div className="flex items-center gap-1">
                  <span>创建时间</span>
                </div>
              </TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                isSelected={!!bulkSelected[log.id]}
                onSelect={handleRowClick}
                onToggleSelect={toggleSelectLog}
                onKeyDown={handleRowKeyDown}
              />
            ))}
            {logs.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-muted-foreground">暂无日志</span>
                    {filter && (
                      <Button variant="outline" size="sm" onClick={clearFilter}>
                        清除过滤器
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {isLoading && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24">
                  <div className="flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* 加载更多 */}
      {logs.length > 0 && hasMore && (
        <div className="flex justify-center py-4">
          <Button variant="secondary" size="lg" onClick={loadMore} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            加载更多
          </Button>
        </div>
      )}

      {/* 批量操作栏 */}
      {totalBulkSelected > 0 && (
        <div className="sticky bottom-4 mx-4 flex items-center gap-4 rounded-lg bg-muted p-4 shadow-lg">
          <span className="text-sm">
            已选择 <strong>{totalBulkSelected}</strong> 条日志
          </span>
          <Button variant="ghost" size="sm" onClick={deselectAll}>
            <X className="mr-1 h-4 w-4" />
            取消
          </Button>
          <div className="flex-1" />
          <Button size="sm" onClick={downloadSelected}>
            <Download className="mr-1 h-4 w-4" />
            下载 JSON
          </Button>
        </div>
      )}
    </div>
  )
}

// 日志行组件
interface LogRowProps {
  log: LogEntry
  isSelected: boolean
  onSelect: (log: LogEntry) => void
  onToggleSelect: (log: LogEntry, e: React.MouseEvent) => void
  onKeyDown: (log: LogEntry, e: React.KeyboardEvent) => void
}

function LogRow({ log, isSelected, onSelect, onToggleSelect, onKeyDown }: LogRowProps) {
  const previewKeys = useMemo(() => extractLogPreviewKeys(log), [log])
  const isRequest = log.data?.type === 'request'

  return (
    <TableRow
      tabIndex={0}
      className="cursor-pointer"
      onClick={() => onSelect(log)}
      onKeyDown={(e) => onKeyDown(log, e)}
    >
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => {}}
          onClick={(e) => onToggleSelect(log, e)}
        />
      </TableCell>
      <TableCell>
        <LogLevel level={log.level} />
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <p className="truncate">{log.message}</p>
          {previewKeys.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {previewKeys.map((keyItem) => (
                <span
                  key={keyItem.key}
                  className={cn(
                    'inline-flex items-center rounded-md px-2 py-0.5 text-xs',
                    keyItem.label === 'label-danger'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : keyItem.label === 'label-warning'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {keyItem.key}:{' '}
                  {isRequest && keyItem.key === 'execTime'
                    ? `${log.data[keyItem.key]}ms`
                    : stringifyValue(log.data[keyItem.key], 'N/A', 80)}
                </span>
              ))}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <LogDate date={log.created} />
      </TableCell>
      <TableCell>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  )
}
