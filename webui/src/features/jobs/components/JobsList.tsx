/**
 * JobsList 组件
 * 任务列表 - 与 UI 版本对齐
 */
import { useCallback } from 'react'
import { Loader2, RotateCcw, Trash2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Job, JobsFilter } from '../store'

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
  const date = new Date(dateStr)
  return date.toLocaleString()
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
    <div className={cn('', className)}>
      {/* 表格容器 - 使用 table-wrapper 样式与 UI 版本一致 */}
      <div className="table-wrapper">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground w-[120px]">ID</th>
              <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">Topic</th>
              <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground w-[100px]">Status</th>
              <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground w-[80px]">Retries</th>
              <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground w-[160px]">Run At</th>
              <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground w-[160px]">Created</th>
              <th className="h-12 px-4 text-right align-middle font-semibold text-muted-foreground w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="h-24 text-center text-muted-foreground">
                  No jobs found.
                </td>
              </tr>
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
          </tbody>
        </table>
      </div>

      {/* 分页 - 与 UI 版本对齐 */}
      {total > 0 && (
        <div className="flex items-center gap-2 mt-3">
          <span className="text-sm text-muted-foreground">
            Showing {showingFrom} - {showingTo} of {total}
          </span>
          <div className="flex-1"></div>
          <Button variant="secondary" size="sm" disabled={!canPrev} onClick={onPrevPage}>
            Previous
          </Button>
          <Button variant="secondary" size="sm" disabled={!canNext} onClick={onNextPage}>
            Next
          </Button>
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
    <tr className="border-b transition-colors hover:bg-muted/50">
      <td className="p-4 align-middle">
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
      </td>
      <td className="p-4 align-middle">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted">
          {job.topic}
        </span>
      </td>
      <td className="p-4 align-middle">
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
            getStatusClass(job.status)
          )}
        >
          {job.status}
        </span>
      </td>
      <td className="p-4 align-middle text-sm">
        {job.retries}/{job.max_retries}
      </td>
      <td className="p-4 align-middle text-sm text-muted-foreground">{formatDate(job.run_at)}</td>
      <td className="p-4 align-middle text-sm text-muted-foreground">{formatDate(job.created)}</td>
      <td className="p-4 align-middle text-right">
        <div className="flex items-center justify-end gap-1">
          {job.status === 'failed' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
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
                      <RotateCcw className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Requeue</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {(job.status === 'pending' || job.status === 'failed') && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {job.last_error && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="h-4 w-4 text-destructive cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px]">
                  <p className="text-xs">{job.last_error}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </td>
    </tr>
  )
}
