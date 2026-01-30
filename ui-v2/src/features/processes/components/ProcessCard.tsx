/**
 * ProcessCard 组件
 * 单个进程卡片
 */
import { useTranslation } from 'react-i18next'
import { Play, Square, RefreshCw, Info, Loader2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ProcessState } from '../types'

interface ProcessCardProps {
  process: ProcessState
  isActionLoading: boolean
  currentAction: string | null
  onRestart: (id: string) => void
  onStop: (id: string) => void
  onStart: (id: string) => void
  onViewDetails: (id: string) => void
  onViewLogs: (id: string) => void
}

export function ProcessCard({
  process,
  isActionLoading,
  currentAction,
  onRestart,
  onStop,
  onStart,
  onViewDetails,
  onViewLogs,
}: ProcessCardProps) {
  const { t } = useTranslation()

  const statusConfig = {
    running: {
      label: t('processes.status.running'),
      variant: 'default' as const,
      className: 'bg-green-500 hover:bg-green-600',
    },
    stopped: {
      label: t('processes.status.stopped'),
      variant: 'secondary' as const,
      className: 'bg-slate-400 hover:bg-slate-500',
    },
    crashed: {
      label: t('processes.status.crashed'),
      variant: 'destructive' as const,
      className: 'bg-red-500 hover:bg-red-600',
    },
    starting: {
      label: t('processes.status.starting'),
      variant: 'outline' as const,
      className: 'bg-blue-500 hover:bg-blue-600 text-white',
    },
  }

  const config = statusConfig[process.status] || statusConfig.stopped
  const isRunning = process.status === 'running'
  const isStopped = process.status === 'stopped'

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-4">
        {/* 左侧: ID 和状态 */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* 状态指示器 */}
          <div
            className={cn(
              'w-2.5 h-2.5 rounded-full shrink-0',
              process.status === 'running' && 'bg-green-500 animate-pulse',
              process.status === 'stopped' && 'bg-slate-400',
              process.status === 'crashed' && 'bg-red-500',
              process.status === 'starting' && 'bg-blue-500 animate-pulse'
            )}
          />

          {/* 进程 ID */}
          <span className="font-mono text-sm font-medium truncate">{process.id}</span>

          {/* 状态 Badge */}
          <Badge className={cn('shrink-0', config.className)}>{config.label}</Badge>
        </div>

        {/* 中间: 信息 */}
        <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
          {process.pid > 0 && (
            <span className="font-mono">
              {t('processes.card.pid')}: <span className="text-foreground">{process.pid}</span>
            </span>
          )}
          {process.uptime && (
            <span>
              {t('processes.card.uptime')}: <span className="text-foreground">{process.uptime}</span>
            </span>
          )}
          {process.restartCount > 0 && (
            <span>
              {t('processes.card.restarts')}: <span className="text-foreground">{process.restartCount}</span>
            </span>
          )}
        </div>

        {/* 右侧: 操作按钮 */}
        <div className="flex items-center gap-1 shrink-0">
          <TooltipProvider delayDuration={300}>
            {/* 详情按钮 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onViewDetails(process.id)}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('processes.card.viewDetails')}</TooltipContent>
            </Tooltip>

            {/* 日志按钮 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onViewLogs(process.id)}
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('processes.card.viewLogs')}</TooltipContent>
            </Tooltip>

            {/* 启动按钮 (仅停止状态显示) */}
            {isStopped && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => onStart(process.id)}
                    disabled={isActionLoading}
                  >
                    {currentAction === 'start' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('processes.card.start')}</TooltipContent>
              </Tooltip>
            )}

            {/* 重启按钮 (仅运行状态显示) */}
            {isRunning && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => onRestart(process.id)}
                    disabled={isActionLoading}
                  >
                    {currentAction === 'restart' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('processes.card.restart')}</TooltipContent>
              </Tooltip>
            )}

            {/* 停止按钮 (运行或启动中显示) */}
            {(isRunning || process.status === 'starting') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onStop(process.id)}
                    disabled={isActionLoading}
                  >
                    {currentAction === 'stop' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('processes.card.stop')}</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      </div>

      {/* 错误信息 (如果有) */}
      {process.lastError && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1 font-mono truncate">
          {process.lastError}
        </div>
      )}
    </Card>
  )
}
