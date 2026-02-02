/**
 * Processes 页面
 * 进程管理
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ProcessStats,
  ProcessFilters,
  ProcessList,
  ProcessDetails,
  ProcessLogs,
  useProcesses,
} from '@/features/processes'
import type { ProcessState } from '@/features/processes'
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

// 自动刷新间隔 (5秒)
const AUTO_REFRESH_INTERVAL = 5000

export default function ProcessesPage() {
  const { t } = useTranslation()
  const {
    filteredProcesses,
    stats,
    isLoading,
    filter,
    actionLoading,
    lastRefresh,
    loadProcesses,
    restartProcess,
    stopProcess,
    startProcess,
    updateFilter,
    clearFilter,
  } = useProcesses()

  // 详情面板状态
  const [selectedProcess, setSelectedProcess] = useState<ProcessState | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // 日志面板状态
  const [logsProcessId, setLogsProcessId] = useState<string | null>(null)
  const [logsOpen, setLogsOpen] = useState(false)

  // 操作确认状态
  const [confirmAction, setConfirmAction] = useState<{
    type: 'stop' | 'restart'
    processId: string
  } | null>(null)

  // 自动刷新
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 初始加载
  useEffect(() => {
    loadProcesses()
  }, [])

  // 自动刷新
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      loadProcesses()
    }, AUTO_REFRESH_INTERVAL)

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current)
      }
    }
  }, [loadProcesses])

  // 查看详情
  const handleViewDetails = useCallback(
    (processId: string) => {
      const process = filteredProcesses.find((p) => p.id === processId)
      if (process) {
        setSelectedProcess(process)
        setDetailsOpen(true)
      }
    },
    [filteredProcesses]
  )

  // 关闭详情
  const handleCloseDetails = useCallback(() => {
    setDetailsOpen(false)
    setSelectedProcess(null)
  }, [])

  // 查看日志
  const handleViewLogs = useCallback((processId: string) => {
    setLogsProcessId(processId)
    setLogsOpen(true)
  }, [])

  // 关闭日志面板
  const handleCloseLogs = useCallback(() => {
    setLogsOpen(false)
    setLogsProcessId(null)
  }, [])

  // 重启进程 (需要确认)
  const handleRestart = useCallback((processId: string) => {
    setConfirmAction({ type: 'restart', processId })
  }, [])

  // 停止进程 (需要确认)
  const handleStop = useCallback((processId: string) => {
    setConfirmAction({ type: 'stop', processId })
  }, [])

  // 启动进程 (直接启动)
  const handleStart = useCallback(
    async (processId: string) => {
      await startProcess(processId)
    },
    [startProcess]
  )

  // 确认操作
  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return

    if (confirmAction.type === 'restart') {
      await restartProcess(confirmAction.processId)
    } else if (confirmAction.type === 'stop') {
      await stopProcess(confirmAction.processId)
    }

    setConfirmAction(null)
  }, [confirmAction, restartProcess, stopProcess])

  // 取消确认
  const handleCancelConfirm = useCallback(() => {
    setConfirmAction(null)
  }, [])

  // 格式化最后刷新时间
  const formatLastRefresh = () => {
    if (!lastRefresh) return '-'
    return lastRefresh.toLocaleTimeString()
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <ProcessStats stats={stats} isLoading={isLoading && stats.total === 0} />

      {/* 进程列表 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl">{t('processes.title')}</CardTitle>
          <div className="flex items-center gap-3">
            {/* 最后刷新时间 */}
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{t('processes.lastRefresh')}: {formatLastRefresh()}</span>
            </div>
            {/* 刷新按钮 */}
            <Button variant="outline" size="sm" onClick={() => loadProcesses()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {t('processes.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 筛选器 */}
          <ProcessFilters filter={filter} onChange={updateFilter} onClear={clearFilter} />

          {/* 列表 */}
          <ProcessList
            processes={filteredProcesses}
            isLoading={isLoading}
            actionLoading={actionLoading}
            onRestart={handleRestart}
            onStop={handleStop}
            onStart={handleStart}
            onViewDetails={handleViewDetails}
            onViewLogs={handleViewLogs}
          />
        </CardContent>
      </Card>

      {/* 详情面板 */}
      <ProcessDetails
        process={selectedProcess}
        open={detailsOpen}
        onClose={handleCloseDetails}
      />

      {/* 日志面板 */}
      <ProcessLogs
        processId={logsProcessId}
        open={logsOpen}
        onClose={handleCloseLogs}
      />

      {/* 操作确认对话框 */}
      <AlertDialog open={!!confirmAction} onOpenChange={handleCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'restart' ? t('processes.confirm.restartTitle') : t('processes.confirm.stopTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'restart'
                ? t('processes.confirm.restartMessage', { processId: confirmAction?.processId })
                : t('processes.confirm.stopMessage', { processId: confirmAction?.processId })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelConfirm}>{t('processes.confirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>
              {confirmAction?.type === 'restart' ? t('processes.confirm.restart') : t('processes.confirm.stop')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
