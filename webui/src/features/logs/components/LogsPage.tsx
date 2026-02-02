/**
 * Logs 页面
 * 日志查看和筛选 - Apple 风格侧边面板
 */
import { useEffect, useState } from 'react'
import { useLogs, type LogEntry } from '@/features/logs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, Search, ChevronUp, ChevronDown, X } from 'lucide-react'

// 日志级别映射 - 使用统一的 slate 灰色系
const levelMap: Record<number, { label: string; color: string }> = {
  0: { label: 'DEBUG', color: 'bg-slate-400' },
  4: { label: 'INFO', color: 'bg-blue-500' },
  8: { label: 'WARN', color: 'bg-slate-600' },
  16: { label: 'ERROR', color: 'bg-red-500' },
}

function LogLevel({ level }: { level: number }) {
  const info = levelMap[level] || { label: `L${level}`, color: 'bg-slate-400' }
  return (
    <Badge variant="secondary" className={`${info.color} text-white text-xs`}>
      {info.label}
    </Badge>
  )
}

function LogDate({ date }: { date: string }) {
  const d = new Date(date)
  return (
    <span className="text-xs text-slate-500">
      {d.toLocaleDateString()} {d.toLocaleTimeString()}
    </span>
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
    loadLogs,
    loadMore,
    refresh,
    setActiveLog,
    setFilter,
    setSort,
  } = useLogs()

  const [searchInput, setSearchInput] = useState('')

  useEffect(() => {
    loadLogs(1)
  }, [filter, sort])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilter(searchInput)
  }

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

  const selectLog = (log: LogEntry) => {
    setActiveLog(log)
  }

  const closeDetail = () => {
    setActiveLog(null)
  }

  return (
    <div className="h-full flex">
      {/* 左侧：日志列表 */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${activeLog ? 'mr-[400px]' : ''}`}>
        {/* 头部 */}
        <header className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Logs</h1>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </header>

        {/* 搜索 */}
        <div className="px-4 py-3 border-b border-slate-100">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search logs..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 h-9 rounded-lg bg-slate-50 border-slate-200"
              />
            </div>
          </form>
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
                    <TableHead className="w-20">
                      <button className="flex items-center gap-1 text-xs" onClick={() => handleSort('level')}>
                        Level {getSortIcon('level')}
                      </button>
                    </TableHead>
                    <TableHead className="text-xs">Message</TableHead>
                    <TableHead className="w-36">
                      <button
                        className="flex items-center gap-1 text-xs"
                        onClick={() => handleSort('created')}
                      >
                        Time {getSortIcon('created')}
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
                      onClick={() => selectLog(log)}
                    >
                      <TableCell className="py-2">
                        <LogLevel level={log.level} />
                      </TableCell>
                      <TableCell className="py-2 font-mono text-xs truncate max-w-md text-slate-700">
                        {log.message}
                      </TableCell>
                      <TableCell className="py-2">
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
      </div>

      {/* 右侧：详情面板 (Apple 风格 Inspector) */}
      <div
        className={`fixed right-0 top-0 h-full w-[400px] bg-white border-l border-slate-200 shadow-xl transform transition-transform duration-300 ease-out ${
          activeLog ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {activeLog && (
          <div className="h-full flex flex-col">
            {/* 面板头部 */}
            <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">Log Details</span>
                <LogLevel level={activeLog.level} />
              </div>
              <Button variant="ghost" size="sm" onClick={closeDetail} className="h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* 面板内容 */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* 时间 */}
              <div>
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  Timestamp
                </h4>
                <p className="text-sm text-slate-900">
                  {new Date(activeLog.created).toLocaleString()}
                </p>
              </div>

              {/* 消息 */}
              <div>
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  Message
                </h4>
                <div className="font-mono text-sm bg-slate-100 p-3 rounded-lg text-slate-800 break-all">
                  {activeLog.message}
                </div>
              </div>

              {/* 数据 */}
              {activeLog.data && Object.keys(activeLog.data).length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                    Data
                  </h4>
                  <pre className="font-mono text-xs bg-slate-100 p-3 rounded-lg overflow-auto max-h-[400px] text-slate-700">
                    {JSON.stringify(activeLog.data, null, 2)}
                  </pre>
                </div>
              )}

              {/* ID */}
              <div>
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  Log ID
                </h4>
                <p className="font-mono text-xs text-slate-600">{activeLog.id}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LogsPage
