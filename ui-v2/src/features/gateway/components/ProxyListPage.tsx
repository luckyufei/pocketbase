/**
 * ProxyListPage 组件
 * 代理配置列表页
 */
import { useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProxies } from '../hooks/useProxies'
import { ProxyCard } from './ProxyCard'
import type { ProxyStatus } from '../types'

/**
 * 轮询间隔（毫秒）
 */
const POLLING_INTERVAL = 5000

export function ProxyListPage() {
  const navigate = useNavigate()
  const {
    filteredProxies,
    stats,
    metrics,
    isLoading,
    filter,
    loadProxies,
    loadMetrics,
    setFilter,
    getProxyStatus,
  } = useProxies()

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 初始加载
  useEffect(() => {
    loadProxies()
    loadMetrics()
  }, [loadProxies, loadMetrics])

  // 轮询指标
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      loadMetrics()
    }, POLLING_INTERVAL)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [loadMetrics])

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadProxies(), loadMetrics()])
  }, [loadProxies, loadMetrics])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter({ ...filter, search: e.target.value })
    },
    [filter, setFilter]
  )

  const handleStatusChange = useCallback(
    (value: string) => {
      setFilter({ ...filter, status: value as 'all' | ProxyStatus })
    },
    [filter, setFilter]
  )

  const handleCreateClick = useCallback(() => {
    navigate('/gateway/new')
  }, [navigate])

  return (
    <div className="h-full flex flex-col">
      {/* 页面头部 */}
      <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold text-slate-900">Gateway Proxies</h1>
        <Button
          onClick={handleCreateClick}
          className="bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-200/50"
        >
          <Plus className="w-4 h-4 mr-1" />
          新建代理
        </Button>
      </div>

      {/* 筛选栏 */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0">
        {/* 搜索框 */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="搜索代理..."
            value={filter.search}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>

        {/* 状态筛选 */}
        <Select value={filter.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部 ({stats.total})</SelectItem>
            <SelectItem value="normal">正常 ({stats.normal})</SelectItem>
            <SelectItem value="circuit-open">熔断 ({stats.circuitOpen})</SelectItem>
            <SelectItem value="disabled">禁用 ({stats.disabled})</SelectItem>
          </SelectContent>
        </Select>

        {/* 刷新按钮 */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* 代理列表 */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading && filteredProxies.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            加载中...
          </div>
        ) : filteredProxies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <p className="mb-2">暂无代理配置</p>
            <Button variant="link" onClick={handleCreateClick} className="text-blue-600">
              创建第一个代理
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredProxies.map((proxy) => {
              const proxyMetrics = metrics.find((m) => m.proxyName === proxy.name)
              return (
                <ProxyCard
                  key={proxy.id}
                  proxy={proxy}
                  metrics={proxyMetrics}
                  status={getProxyStatus(proxy)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
