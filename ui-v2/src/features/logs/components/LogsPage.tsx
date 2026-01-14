/**
 * Logs 页面
 * 日志查看和筛选
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, RefreshCw, Search, ChevronUp, ChevronDown } from 'lucide-react'

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
  const [isDetailOpen, setIsDetailOpen] = useState(false)

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

  const openDetail = (log: LogEntry) => {
    setActiveLog(log)
    setIsDetailOpen(true)
  }

  const closeDetail = () => {
    setIsDetailOpen(false)
    setActiveLog(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <header className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Logs</h1>
          <Button variant="outline" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* 搜索 */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search logs... (e.g., level:error, message~'error')"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </header>

      {/* 日志列表 */}
      <div className="flex-1 overflow-auto">
        {isLoading && logs.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No logs found</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">
                    <button className="flex items-center gap-1" onClick={() => handleSort('level')}>
                      Level {getSortIcon('level')}
                    </button>
                  </TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-40">
                    <button
                      className="flex items-center gap-1"
                      onClick={() => handleSort('created')}
                    >
                      Created {getSortIcon('created')}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => openDetail(log)}
                  >
                    <TableCell>
                      <LogLevel level={log.level} />
                    </TableCell>
                    <TableCell className="font-mono text-sm truncate max-w-md">
                      {log.message}
                    </TableCell>
                    <TableCell>
                      <LogDate date={log.created} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* 加载更多 */}
            {hasMore && (
              <div className="p-4 text-center">
                <Button variant="outline" onClick={loadMore} disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 日志详情对话框 */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Log Details
              {activeLog && <LogLevel level={activeLog.level} />}
            </DialogTitle>
          </DialogHeader>
          {activeLog && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-1">Created</h4>
                <p className="text-slate-900">{new Date(activeLog.created).toLocaleString()}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-1">Message</h4>
                <p className="font-mono text-sm bg-slate-100 p-2 rounded-lg">{activeLog.message}</p>
              </div>
              {activeLog.data && Object.keys(activeLog.data).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Data</h4>
                  <pre className="font-mono text-xs bg-slate-100 p-2 rounded-lg overflow-auto max-h-64">
                    {JSON.stringify(activeLog.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default LogsPage
