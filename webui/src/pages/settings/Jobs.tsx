/**
 * Jobs 页面
 * 任务队列管理 - 与 UI 版本对齐
 */
import { useEffect, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export default function JobsPage() {
  const { t } = useTranslation()
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
    <div className="p-6 space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-lg">
        <span className="text-muted-foreground">{t('settingsPage.breadcrumbSettings')}</span>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{t('settingsPage.jobs.breadcrumb')}</span>
      </div>

      {/* 统计卡片 */}
      <JobsStats stats={stats} isLoading={isLoadingStats} />

      {/* 任务列表面板 - 使用 panel 样式，与 UI 版本一致 */}
      <div className="panel">
        {/* Title bar */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl font-medium">{t('settingsPage.jobs.jobQueue')}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={refresh}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('settingsPage.jobs.refresh')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* 筛选器 */}
        <JobsFilters filter={filter} onChange={updateFilter} onClear={clearFilter} className="mb-2" />

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
      </div>

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settingsPage.jobs.confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settingsPage.jobs.confirmDeleteDesc', { jobId: deleteConfirm })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('settingsPage.jobs.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>{t('settingsPage.jobs.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
