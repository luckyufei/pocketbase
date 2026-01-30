/**
 * useProcessLogs Hook
 * 进程日志管理 Hook
 */
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useRef, useEffect } from 'react'
import { getApiClient } from '@/lib/ApiClient'
import { toast } from 'sonner'
import {
  processLogsAtom,
  logsLoadingAtom,
  logsAutoScrollAtom,
  selectedLogProcessAtom,
  logsPollingAtom,
  setProcessLogsAtom,
  setLogsLoadingAtom,
  setLogsAutoScrollAtom,
  toggleLogsAutoScrollAtom,
  setSelectedLogProcessAtom,
  setLogsPollingAtom,
  clearLogsAtom,
  type ProcessLog,
} from '../store'

// 默认获取的日志行数
const DEFAULT_LOG_LINES = 100
// 轮询间隔（毫秒）
const POLLING_INTERVAL = 1000

/**
 * 进程日志管理 Hook
 */
export function useProcessLogs() {
  const logs = useAtomValue(processLogsAtom)
  const [isLoading, setIsLoading] = useAtom(logsLoadingAtom)
  const autoScroll = useAtomValue(logsAutoScrollAtom)
  const selectedProcessId = useAtomValue(selectedLogProcessAtom)
  const isPolling = useAtomValue(logsPollingAtom)

  const setLogs = useSetAtom(setProcessLogsAtom)
  const setAutoScroll = useSetAtom(setLogsAutoScrollAtom)
  const toggleAutoScroll = useSetAtom(toggleLogsAutoScrollAtom)
  const setSelectedProcess = useSetAtom(setSelectedLogProcessAtom)
  const setPolling = useSetAtom(setLogsPollingAtom)
  const clearLogs = useSetAtom(clearLogsAtom)

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pb = getApiClient()

  /**
   * 加载指定进程的日志
   */
  const loadLogs = useCallback(
    async (processId: string, lines: number = DEFAULT_LOG_LINES) => {
      setIsLoading(true)

      try {
        const result = await pb.send(`/api/pm/${processId}/logs?lines=${lines}`, {
          method: 'GET',
        })

        setLogs((result || []) as ProcessLog[])
        setSelectedProcess(processId)
      } catch (err) {
        console.error('Failed to load process logs:', err)
        toast.error('加载进程日志失败')
      } finally {
        setIsLoading(false)
      }
    },
    [pb, setLogs, setIsLoading, setSelectedProcess]
  )

  /**
   * 启动轮询
   */
  const startPolling = useCallback(
    (processId: string) => {
      // 先停止已有的轮询
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }

      setSelectedProcess(processId)
      setPolling(true)

      // 立即加载一次
      loadLogs(processId)

      // 设置定时轮询
      pollingIntervalRef.current = setInterval(() => {
        loadLogs(processId)
      }, POLLING_INTERVAL)
    },
    [loadLogs, setSelectedProcess, setPolling]
  )

  /**
   * 停止轮询
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setPolling(false)
  }, [setPolling])

  /**
   * 打开日志面板
   */
  const openLogs = useCallback(
    async (processId: string) => {
      await loadLogs(processId)
    },
    [loadLogs]
  )

  /**
   * 关闭日志面板
   */
  const closeLogs = useCallback(() => {
    stopPolling()
    clearLogs()
  }, [stopPolling, clearLogs])

  // 组件卸载时清理轮询
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  return {
    // 状态
    logs,
    isLoading,
    autoScroll,
    selectedProcessId,
    isPolling,

    // 操作
    loadLogs,
    startPolling,
    stopPolling,
    openLogs,
    closeLogs,
    clearLogs,
    toggleAutoScroll,
    setAutoScroll,
  }
}
