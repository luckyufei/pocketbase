/**
 * JobsList 组件
 * 任务列表
 */
import { useMemo, useCallback } from 'react'
import { Loader2, RefreshCw, Trash2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Job, JobsFilter } from '../store'
import dayjs from 'dayjs'

interface JobsListProps {
  jobs: Job[]
  isLoading?: boolean
  filter: JobsFilter
  total: number
  actionLoading: Record<string, string | null>
  onRequeue: (jobId: string) => void
  onDelete: (jobId: string) => void
  onPrevPage: () => void
  onNextPage: () => void
  className?: string
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'processing':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'completed':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'failed':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-'
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss')
}

function truncateId(id: string): string {
  if (!id || id.length <= 12) return id
  return id.substring(0, 8) + '...' + id.substring(id.length - 4)
}

export function JobsList({
  jobs,
  isLoading = false,
  filter,
  total,
  actionLoading,
  onRequeue,
  onDelete,
  onPrevPage,
  onNextPage,
  className,
}: JobsListProps) {
  const showingFrom = filter.offset + 1
  const showingTo = Math.min(filter.offset + filter.limit, total)
  const canPrev = filter.offset > 0
  const canNext = filter.offset + filter.limit < total

  return (
    <div className={cn('space-y-4', className)}>
      <ScrollArea className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">ID</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[80px]">重试</TableHead>
              <TableHead className="w-[160px]">运行时间</TableHead>
              <TableHead className="w-[160px]">创建时间</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  暂无任务
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  actionLoading={actionLoading[job.id]}
                  onRequeue={onRequeue}
                  onDelete={onDelete}
                />
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* 分页 */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            显示 {showingFrom} - {showingTo} / 共 {total} 条
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!canPrev} onClick={onPrevPage}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              上一页
            </Button>
            <Button variant="outline" size="sm" disabled={!canNext} onClick={onNextPage}>
              下一页
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// 任务行组件
interface JobRowProps {
  job: Job
  actionLoading: string | null | undefined
  onRequeue: (jobId: string) => void
  onDelete: (jobId: string) => void
}

function JobRow({ job, actionLoading, onRequeue, onDelete }: JobRowProps) {
  const handleRequeue = useCallback(() => {
    onRequeue(job.id)
  }, [job.id, onRequeue])

  const handleDelete = useCallback(() => {
    onDelete(job.id)
  }, [job.id, onDelete])

  return (
    <TableRow>
      <TableCell>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <code className="text-xs font-mono cursor-help">{truncateId(job.id)}</code>
            </TooltipTrigger>
            <TooltipContent>
              <p>{job.id}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted">
          {job.topic}
        </span>
      </TableCell>
      <TableCell>
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
            getStatusClass(job.status)
          )}
        >
          {job.status}
        </span>
      </TableCell>
      <TableCell className="text-sm">
        {job.retries}/{job.max_retries}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatDate(job.run_at)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatDate(job.created)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {job.status === 'failed' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!!actionLoading}
              onClick={handleRequeue}
            >
              {actionLoading === 'requeue' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          )}
          {(job.status === 'pending' || job.status === 'failed') && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              disabled={!!actionLoading}
              onClick={handleDelete}
            >
              {actionLoading === 'delete' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )}
          {job.last_error && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px]">
                  <p className="text-xs">{job.last_error}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
