/**
 * ProxyCard 组件
 * 代理配置卡片展示
 */
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { Proxy, ProxyMetrics, ProxyStatus } from '../types'

interface ProxyCardProps {
  proxy: Proxy
  metrics?: ProxyMetrics
  status: ProxyStatus
  onClick?: () => void
}

/**
 * 状态图标映射
 */
const statusIcons: Record<ProxyStatus, string> = {
  normal: '🟢',
  'circuit-open': '🔴',
  disabled: '⚫',
}

/**
 * 状态文字映射
 */
const statusLabels: Record<ProxyStatus, string> = {
  normal: '正常',
  'circuit-open': '熔断',
  disabled: '禁用',
}

export function ProxyCard({ proxy, metrics, status, onClick }: ProxyCardProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      navigate(`/gateway/${proxy.id}`)
    }
  }

  return (
    <div
      className={cn(
        'p-4 rounded-xl border border-slate-200 bg-white cursor-pointer',
        'hover:border-blue-300 hover:shadow-md transition-all duration-200',
        status === 'circuit-open' && 'border-red-200 bg-red-50/30',
        status === 'disabled' && 'opacity-60'
      )}
      onClick={handleClick}
    >
      {/* 头部：路径和状态 */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-slate-900 truncate">{proxy.path}</h3>
        <span className="flex items-center gap-1 text-sm">
          <span>{statusIcons[status]}</span>
          <span
            className={cn(
              'text-slate-600',
              status === 'circuit-open' && 'text-red-600',
              status === 'disabled' && 'text-slate-400'
            )}
          >
            {statusLabels[status]}
          </span>
        </span>
      </div>

      {/* 目标地址 */}
      <p className="text-sm text-slate-500 mb-3 truncate">→ {proxy.upstream}</p>

      {/* 配置摘要 */}
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>
          并发: {proxy.maxConcurrent === 0 || !proxy.maxConcurrent ? '不限' : proxy.maxConcurrent}
        </span>
        <span className="text-slate-300">|</span>
        <span>
          熔断: {proxy.circuitBreaker?.enabled ? '开启' : '关闭'}
        </span>
        <span className="text-slate-300">|</span>
        <span>
          超时: {proxy.timeoutConfig?.responseHeader || proxy.timeout || 30}s
        </span>
      </div>

      {/* 实时指标（如果有） */}
      {metrics && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-400">
          <span>连接: {metrics.activeConnections}</span>
          <span>请求: {metrics.requestsTotal}</span>
          <span>错误: {metrics.errorsTotal}</span>
        </div>
      )}
    </div>
  )
}
