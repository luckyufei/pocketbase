/**
 * Jobs 页面
 * 任务队列管理
 */
import { useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { JobsStats, JobsFilters, JobsList, useJobs } from '@/features/jobs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useState } from 'react'

export default function JobsPage() {
  const {
    jobs,
    stats,
    isLoading,
    isLoadingStats,
    filter,
    total,
    actionLoading,
    loadJobs,
    loadStats,
    refresh,
    requeueJob,
    deleteJob,
    updateFilter,
    prevPage,
    nextPage,
    clearFilter,
  } = useJobs()

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // 初始加载
  useEffect(() => {
    loadJobs()
    loadStats()
  }, [])

  // 确认删除
  const handleDeleteConfirm = useCallback(async () => {
    if (deleteConfirm) {
      await deleteJob(deleteConfirm)
      setDeleteConfirm(null)
    }
  }, [deleteConfirm, deleteJob])

  const handleDeleteClick = useCallback((jobId: string) => {
    setDeleteConfirm(jobId)
  }, [])

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <JobsStats stats={stats} isLoading={isLoadingStats} />

      {/* 任务列表 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl">任务队列</CardTitle>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 筛选器 */}
          <JobsFilters filter={filter} onChange={updateFilter} onClear={clearFilter} />

          {/* 列表 */}
          <JobsList
            jobs={jobs}
            isLoading={isLoading}
            filter={filter}
            total={total}
            actionLoading={actionLoading}
            onRequeue={requeueJob}
            onDelete={handleDeleteClick}
            onPrevPage={prevPage}
            onNextPage={nextPage}
          />
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除任务 "{deleteConfirm}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
