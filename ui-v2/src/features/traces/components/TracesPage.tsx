/**
 * Traces 页面
 * 请求追踪查看
 */
import { useEffect, useState } from 'react'
import { useTraces, type TraceEntry } from '@/features/traces'
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

// HTTP 方法颜色 - 使用统一的 slate 灰色系 + 蓝色点缀
const methodColors: Record<string, string> = {
  GET: 'bg-blue-500',
  POST: 'bg-slate-700',
  PUT: 'bg-slate-600',
  PATCH: 'bg-slate-500',
  DELETE: 'bg-red-500',
}

// 状态码颜色
function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'bg-blue-500'
  if (status >= 300 && status < 400) return 'bg-slate-500'
  if (status >= 400 && status < 500) return 'bg-slate-600'
  if (status >= 500) return 'bg-red-500'
  return 'bg-slate-400'
}

function MethodBadge({ method }: { method: string }) {
  const color = methodColors[method] || 'bg-slate-400'
  return (
    <Badge variant="secondary" className={`${color} text-white text-xs`}>
      {method}
    </Badge>
  )
}

function StatusBadge({ status }: { status: number }) {
  return (
    <Badge variant="secondary" className={`${getStatusColor(status)} text-white text-xs`}>
      {status}
    </Badge>
  )
}

function TraceDate({ date }: { date: string }) {
  const d = new Date(date)
  return (
    <span className="text-xs text-slate-500">
      {d.toLocaleDateString()} {d.toLocaleTimeString()}
    </span>
  )
}

export function TracesPage() {
  const {
    traces,
    activeTrace,
    isLoading,
    filter,
    sort,
    hasMore,
    loadTraces,
    loadMore,
    refresh,
    setActiveTrace,
    setFilter,
    setSort,
  } = useTraces()

  const [searchInput, setSearchInput] = useState('')
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  useEffect(() => {
    loadTraces(1)
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

  const openDetail = (trace: TraceEntry) => {
    setActiveTrace(trace)
    setIsDetailOpen(true)
  }

  const closeDetail = () => {
    setIsDetailOpen(false)
    setActiveTrace(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <header className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Traces</h1>
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
              placeholder="Search traces... (e.g., method='GET', status>=400)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </header>

      {/* Trace 列表 */}
      <div className="flex-1 overflow-auto">
        {isLoading && traces.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : traces.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No traces found</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Method</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="w-20">
                    <button
                      className="flex items-center gap-1"
                      onClick={() => handleSort('status')}
                    >
                      Status {getSortIcon('status')}
                    </button>
                  </TableHead>
                  <TableHead className="w-24">
                    <button
                      className="flex items-center gap-1"
                      onClick={() => handleSort('execTime')}
                    >
                      Time {getSortIcon('execTime')}
                    </button>
                  </TableHead>
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
                {traces.map((trace) => (
                  <TableRow
                    key={trace.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => openDetail(trace)}
                  >
                    <TableCell>
                      <MethodBadge method={trace.method} />
                    </TableCell>
                    <TableCell className="font-mono text-sm truncate max-w-md">
                      {trace.url}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={trace.status} />
                    </TableCell>
                    <TableCell className="text-sm">{(trace.execTime ?? 0).toFixed(2)} ms</TableCell>
                    <TableCell>
                      <TraceDate date={trace.created} />
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

      {/* Trace 详情对话框 */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Trace Details
              {activeTrace && (
                <>
                  <MethodBadge method={activeTrace.method} />
                  <StatusBadge status={activeTrace.status} />
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {activeTrace && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-1">URL</h4>
                <p className="font-mono text-sm bg-slate-100 p-2 rounded-lg break-all">
                  {activeTrace.url}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Execution Time</h4>
                  <p className="text-slate-900">{(activeTrace.execTime ?? 0).toFixed(2)} ms</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Created</h4>
                  <p className="text-slate-900">{new Date(activeTrace.created).toLocaleString()}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">IP</h4>
                  <p className="font-mono text-slate-900">{activeTrace.ip}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Auth</h4>
                  <p className="text-slate-900">{activeTrace.auth || '-'}</p>
                </div>
              </div>
              {activeTrace.userAgent && (
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">User Agent</h4>
                  <p className="text-sm text-slate-600">{activeTrace.userAgent}</p>
                </div>
              )}
              {activeTrace.data && Object.keys(activeTrace.data).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Data</h4>
                  <pre className="font-mono text-xs bg-slate-100 p-2 rounded-lg overflow-auto max-h-64">
                    {JSON.stringify(activeTrace.data, null, 2)}
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

export default TracesPage
