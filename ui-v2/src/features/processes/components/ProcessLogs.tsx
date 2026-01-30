/**
 * ProcessLogs 组件
 * 进程日志面板 (Drawer)
 */
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useCallback } from 'react'
import { X, Loader2, ArrowDown, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { useProcessLogs } from '../hooks/useProcessLogs'

interface ProcessLogsProps {
  processId: string | null
  open: boolean
  onClose: () => void
}

export function ProcessLogs({ processId, open, onClose }: ProcessLogsProps) {
  const { t } = useTranslation()
  const {
    logs,
    isLoading,
    autoScroll,
    isPolling,
    startPolling,
    stopPolling,
    toggleAutoScroll,
    closeLogs,
  } = useProcessLogs()

  const logsContainerRef = useRef<HTMLDivElement>(null)
  const isScrolledToBottomRef = useRef(true)

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (logsContainerRef.current && autoScroll) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
    }
  }, [autoScroll])

  // 监听日志变化，自动滚动
  useEffect(() => {
    scrollToBottom()
  }, [logs, scrollToBottom])

  // 打开时启动轮询
  useEffect(() => {
    if (open && processId) {
      startPolling(processId)
    }
    return () => {
      if (open) {
        stopPolling()
      }
    }
  }, [open, processId, startPolling, stopPolling])

  // 处理关闭
  const handleClose = useCallback(() => {
    closeLogs()
    onClose()
  }, [closeLogs, onClose])

  // 处理滚动事件，检测是否滚动到底部
  const handleScroll = useCallback(() => {
    if (!logsContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10
    isScrolledToBottomRef.current = isAtBottom
  }, [])

  // 切换轮询
  const handleTogglePolling = useCallback(() => {
    if (isPolling) {
      stopPolling()
    } else if (processId) {
      startPolling(processId)
    }
  }, [isPolling, processId, startPolling, stopPolling])

  // 格式化时间戳
  const formatTimestamp = useCallback((timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    } catch {
      return timestamp
    }
  }, [])

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DrawerContent className="h-[80vh] max-h-[800px]">
        <DrawerHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DrawerTitle className="font-mono text-base">
                {t('processes.logs.title')}: {processId}
              </DrawerTitle>
              {isPolling && (
                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse" />
                  {t('processes.logs.live')}
                </Badge>
              )}
              {isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* 轮询控制 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleTogglePolling}
                className="h-8 px-2"
              >
                {isPolling ? (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    {t('processes.logs.pause')}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    {t('processes.logs.resume')}
                  </>
                )}
              </Button>

              {/* 自动滚动控制 */}
              <Button
                variant={autoScroll ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleAutoScroll()}
                className="h-8 px-2"
              >
                <ArrowDown className="h-4 w-4 mr-1" />
                {t('processes.logs.autoScroll')}
              </Button>

              {/* 关闭按钮 */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DrawerHeader>

        {/* 日志内容 */}
        <div
          ref={logsContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto bg-slate-950 p-4 font-mono text-sm"
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              {isLoading ? t('common.loading') : t('processes.logs.empty')}
            </div>
          ) : (
            <div className="space-y-0.5">
              {logs.map((log, index) => (
                <LogLine
                  key={`${log.timestamp}-${index}`}
                  timestamp={formatTimestamp(log.timestamp)}
                  stream={log.stream}
                  content={log.content}
                />
              ))}
            </div>
          )}
        </div>

        {/* 底部状态栏 */}
        <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between bg-slate-50">
          <span>
            {t('processes.logs.totalLines')}: {logs.length}
          </span>
          {!isScrolledToBottomRef.current && autoScroll && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={scrollToBottom}
            >
              <ArrowDown className="h-3 w-3 mr-1" />
              {t('processes.logs.scrollToBottom')}
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

interface LogLineProps {
  timestamp: string
  stream: 'stdout' | 'stderr'
  content: string
}

function LogLine({ timestamp, stream, content }: LogLineProps) {
  const isError = stream === 'stderr'

  return (
    <div
      className={cn(
        'flex gap-2 py-0.5 px-2 rounded hover:bg-slate-900/50',
        isError && 'bg-red-950/30'
      )}
    >
      {/* 时间戳 */}
      <span className="text-slate-500 shrink-0 select-none">{timestamp}</span>

      {/* 流标识 */}
      <span
        className={cn(
          'shrink-0 select-none w-12 text-center rounded text-xs py-0.5',
          isError ? 'text-red-400 bg-red-950/50' : 'text-green-400 bg-green-950/50'
        )}
      >
        {stream}
      </span>

      {/* 内容 */}
      <span
        className={cn(
          'flex-1 whitespace-pre-wrap break-all',
          isError ? 'text-red-300' : 'text-slate-200'
        )}
      >
        {content}
      </span>
    </div>
  )
}
