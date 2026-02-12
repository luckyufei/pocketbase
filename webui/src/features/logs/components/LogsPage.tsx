/**
 * Logs 页面
 * 日志查看和筛选 - 与 UI 版本 1:1 对齐
 */
import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
import { useLogs, type LogEntry } from '@/features/logs'
import { LOG_LEVELS } from '@/lib/logUtils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

// 懒加载 FilterAutocompleteInput（带自动补全功能）
const FilterAutocompleteInput = lazy(() => import('@/components/FilterAutocompleteInput'))
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  X,
  Settings,
  Bookmark,
  FileText,
  Calendar,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
// 自定义 Checkbox 样式，与 UI 版本保持一致
function LogCheckbox({
  checked,
  disabled,
  onChange,
  onClick,
}: {
  checked: boolean
  disabled?: boolean
  onChange?: () => void
  onClick?: (e: React.MouseEvent) => void
}) {
  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return
    e.stopPropagation()
    onClick?.(e)
    onChange?.()
  }

  return (
    <div
      className={`
        relative inline-flex items-center justify-center w-5 h-5 cursor-pointer
        rounded-[3px] border-2 transition-all
        ${checked ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300 hover:border-slate-400'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={handleClick}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
    >
      {checked && (
        <svg
          className="w-3 h-3 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  )
}

import { LogsChart } from './LogsChart'
import { LogViewPanel } from './LogViewPanel'
import { LogsSettingsPanel } from './LogsSettingsPanel'
import { LogLevel } from './LogLevel'
import { LogDate } from './LogDate'

// 预览键配置
const REQUEST_PREVIEW_KEYS = ['status', 'execTime', 'auth', 'authId', 'userIP']

function getPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return 'N/A'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function LogPreviewBadges({ log }: { log: LogEntry }) {
  const data = log.data || {}
  const isRequest = data.type === 'request'
  const badges: { key: string; value: string; isError?: boolean; isWarning?: boolean }[] = []

  if (isRequest) {
    for (const key of REQUEST_PREVIEW_KEYS) {
      if (typeof data[key] !== 'undefined') {
        badges.push({ key, value: getPreviewValue(data[key]) })
      }
    }
  } else {
    // 非请求类型提取前 4 个字段
    const keys = Object.keys(data).filter((k) => k !== 'error' && k !== 'details')
    for (const key of keys.slice(0, 4)) {
      badges.push({ key, value: getPreviewValue(data[key]) })
    }
  }

  // error 和 details 放在最后
  if (data.error) {
    badges.push({
      key: 'error',
      value: typeof data.error === 'string' ? data.error : 'Error',
      isError: true,
    })
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {badges.map((badge, idx) => (
        <span
          key={idx}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded ${
            badge.isError
              ? 'bg-red-50 text-red-600'
              : badge.isWarning
                ? 'bg-amber-50 text-amber-600'
                : 'bg-slate-100 text-slate-500'
          }`}
        >
          <span className="font-medium">{badge.key}:</span>
          <span className="max-w-[100px] truncate">{badge.value}</span>
        </span>
      ))}
    </div>
  )
}

export function LogsPage() {
  const {
    logs,
    activeLog,
    isLoading,
    filter,
    sort,
    hasMore,
    withSuperuserLogs,
    chartData,
    totalLogs,
    chartLoading,
    loadLogs,
    loadMore,
    loadStats,
    refresh,
    setActiveLog,
    setFilter,
    setSort,
    setZoom,
    setWithSuperuserLogs,
  } = useLogs()

  const [searchInput, setSearchInput] = useState(filter)
  const [showSettings, setShowSettings] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
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
  const toggleSelectLog = useCallback((log: LogEntry) => {
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

  // 重置选择
  const deselectAll = useCallback(() => {
    setBulkSelected({})
  }, [])

  // 下载选中的日志为 JSON
  const downloadSelected = useCallback(() => {
    // 提取选中的日志对象并按创建时间降序排序
    const selected = Object.values(bulkSelected).sort((a, b) => {
      if (a.created < b.created) return 1
      if (a.created > b.created) return -1
      return 0
    })

    if (!selected.length) return

    // 生成文件名
    const dateFilenameRegex = /[-:\. ]/gi
    let filename: string

    if (selected.length === 1) {
      filename = `log_${selected[0].created.replace(dateFilenameRegex, '')}.json`
    } else {
      const to = selected[0].created.replace(dateFilenameRegex, '')
      const from = selected[selected.length - 1].created.replace(dateFilenameRegex, '')
      filename = `${selected.length}_logs_${from}_to_${to}.json`
    }

    // 创建下载
    const jsonString = JSON.stringify(selected.length === 1 ? selected[0] : selected, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [bulkSelected])

  // 初始加载
  useEffect(() => {
    loadLogs(1)
    loadStats()
  }, [])

  // 同步搜索输入与过滤条件（当外部改变 filter 时）
  useEffect(() => {
    setSearchInput(filter)
  }, [filter])

  // 过滤条件变化时重新加载
  useEffect(() => {
    loadLogs(1)
    loadStats()
  }, [filter, sort, withSuperuserLogs])

  const handleSort = (field: string) => {
    if (sort === field) {
      setSort(`-${field}`)
    } else if (sort === `-${field}`) {
      setSort(field)
    } else {
      setSort(`-${field}`)
    }
  }

  const getSortIcon = (field: string) => {
    if (sort === field) return <ChevronUp className="w-4 h-4" />
    if (sort === `-${field}`) return <ChevronDown className="w-4 h-4" />
    return null
  }

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1)
    refresh()
  }

  const handleZoomChange = useCallback(
    (zoom: { min?: string; max?: string }) => {
      setZoom(zoom)
      if (zoom.min && zoom.max) {
        loadLogs(1)
      }
    },
    [setZoom, loadLogs]
  )

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <header className="h-14 px-4 border-b border-slate-200 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold text-slate-900">Logs</h1>
        <div className="flex items-center gap-3">
          {/* 设置按钮 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                  className="h-8 w-8 p-0"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Logs settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* 刷新按钮 */}
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Include superusers 开关 */}
          <div className="flex items-center gap-2">
            <Switch
              id="superuser-logs"
              checked={withSuperuserLogs}
              onCheckedChange={setWithSuperuserLogs}
            />
            <Label
              htmlFor="superuser-logs"
              className="text-sm text-slate-600 cursor-pointer whitespace-nowrap"
            >
              Include requests by superusers
            </Label>
          </div>
        </div>
      </header>

      {/* 搜索栏 - 使用 FilterAutocompleteInput 提供自动补全提示 */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <Suspense fallback={<div className="h-9 rounded-full bg-slate-100 animate-pulse" />}>
          <FilterAutocompleteInput
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={(value) => setFilter(value)}
            placeholder={`Search term or filter like 'level > 0 && data.auth = "guest"'`}
            className="h-10"
            extraAutocompleteKeys={['level', 'message', 'data.']}
          />
        </Suspense>

        {/* 日志级别信息 - 与 UI 版本一致 */}
        <div className="mt-2 text-xs text-slate-400">
          <span>Default log levels:</span>
          <span className="inline-flex gap-1.5 ml-1">
            {LOG_LEVELS.map((l) => (
              <code
                key={l.level}
                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px]"
              >
                {l.level}:{l.label}
              </code>
            ))}
          </span>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <LogsChart
          key={refreshKey}
          data={chartData}
          totalLogs={totalLogs}
          isLoading={chartLoading}
          onZoomChange={handleZoomChange}
        />
      </div>

      {/* 日志列表 */}
      <div className="flex-1 overflow-auto">
        {isLoading && logs.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No logs found</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-[50px]">
                    <LogCheckbox
                      checked={areAllLogsSelected}
                      disabled={logs.length === 0}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap">
                    <button
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      onClick={() => handleSort('level')}
                    >
                      <Bookmark className="h-4 w-4" />
                      <span>level</span>
                      {getSortIcon('level')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>message</span>
                    </div>
                  </TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap">
                    <button
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      onClick={() => handleSort('created')}
                    >
                      <Calendar className="h-4 w-4" />
                      <span>created</span>
                      {getSortIcon('created')}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className={`cursor-pointer transition-colors ${
                      activeLog?.id === log.id
                        ? 'bg-blue-50 hover:bg-blue-50'
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => setActiveLog(log)}
                  >
                    <TableCell className="py-2 align-top" onClick={(e) => e.stopPropagation()}>
                      <LogCheckbox
                        checked={!!bulkSelected[log.id]}
                        onChange={() => toggleSelectLog(log)}
                      />
                    </TableCell>
                    <TableCell className="py-2 align-top whitespace-nowrap">
                      <LogLevel level={log.level} />
                    </TableCell>
                    <TableCell className="py-2 align-top">
                      <div className="font-mono text-xs text-slate-700 truncate max-w-md">
                        {log.message}
                      </div>
                      <LogPreviewBadges log={log} />
                    </TableCell>
                    <TableCell className="py-2 align-top whitespace-nowrap">
                      <LogDate date={log.created} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* 加载更多 */}
            {hasMore && (
              <div className="p-4 text-center">
                <Button variant="ghost" size="sm" onClick={loadMore} disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 批量操作栏 - 与 UI 版本保持一致 */}
      {totalBulkSelected > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <div className="flex items-center gap-3 px-4 py-2 rounded-full border border-slate-200 bg-white/95 backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            <span className="text-sm text-slate-600">
              Selected <strong className="text-slate-900">{totalBulkSelected}</strong> {totalBulkSelected === 1 ? 'log' : 'logs'}
            </span>
            <button
              type="button"
              className="px-2.5 py-1 text-sm text-slate-600 border border-slate-300 rounded hover:bg-slate-50 hover:border-slate-400 transition-colors"
              onClick={deselectAll}
            >
              Reset
            </button>
            <div className="w-12" />
            <button
              type="button"
              className="px-3 py-1.5 text-sm font-medium text-white bg-slate-800 rounded hover:bg-slate-700 transition-colors"
              onClick={downloadSelected}
            >
              Download as JSON
            </button>
          </div>
        </div>
      )}

      {/* 详情面板 */}
      <LogViewPanel log={activeLog} onClose={() => setActiveLog(null)} />

      {/* 设置面板 */}
      <LogsSettingsPanel open={showSettings} onOpenChange={setShowSettings} onSave={handleRefresh} />
    </div>
  )
}

export default LogsPage
