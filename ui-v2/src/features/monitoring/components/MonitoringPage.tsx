/**
 * Monitoring 页面
 * 系统监控仪表盘
 */
import { useEffect } from 'react'
import { useMetrics, type SystemMetrics } from '@/features/monitoring'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, RefreshCw, Cpu, HardDrive, Activity, Database } from 'lucide-react'

// 指标卡片组件
function MetricsCard({
  title,
  value,
  unit,
  icon: Icon,
  subValue,
}: {
  title: string
  value: string | number
  unit?: string
  icon: React.ComponentType<{ className?: string }>
  subValue?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">
          {value}
          {unit && <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>}
        </div>
        {subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}
      </CardContent>
    </Card>
  )
}

// 格式化数值
function formatValue(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '-'
  return Number(value).toFixed(decimals)
}

// 格式化字节
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function MonitoringPage() {
  const {
    currentMetrics,
    historyData,
    isLoading,
    error,
    selectedRange,
    loadData,
    refresh,
    changeRange,
    startAutoRefresh,
    stopAutoRefresh,
  } = useMetrics()

  useEffect(() => {
    loadData()
    startAutoRefresh()

    return () => {
      stopAutoRefresh()
    }
  }, [])

  // 当时间范围改变时重新加载
  useEffect(() => {
    loadData()
  }, [selectedRange])

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <header className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">System Monitoring</h1>
          <div className="flex items-center gap-2">
            <Select value={selectedRange} onValueChange={(v) => changeRange(v as any)}>
              <SelectTrigger className="w-32 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last 1 hour</SelectItem>
                <SelectItem value="6h">Last 6 hours</SelectItem>
                <SelectItem value="12h">Last 12 hours</SelectItem>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={refresh} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* 内容 */}
      <div className="flex-1 overflow-auto p-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 border border-red-200">
            {error}
          </div>
        )}

        {isLoading && !currentMetrics ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : currentMetrics ? (
          <div className="space-y-6">
            {/* 指标卡片 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricsCard
                title="CPU Usage"
                value={formatValue(currentMetrics.cpu)}
                unit="%"
                icon={Cpu}
              />
              <MetricsCard
                title="Memory Usage"
                value={formatValue(currentMetrics.memory)}
                unit="%"
                icon={HardDrive}
                subValue={`${formatBytes((currentMetrics.memoryUsed ?? 0) * 1024 * 1024)} / ${formatBytes((currentMetrics.memoryTotal ?? 0) * 1024 * 1024)}`}
              />
              <MetricsCard
                title="Goroutines"
                value={currentMetrics.goroutines ?? 0}
                icon={Activity}
              />
              <MetricsCard
                title="DB Connections"
                value={currentMetrics.dbOpenConnections ?? 0}
                icon={Database}
                subValue={`${currentMetrics.dbIdleConnections ?? 0} idle`}
              />
            </div>

            {/* 请求统计 */}
            <div className="grid gap-4 md:grid-cols-3">
              <MetricsCard
                title="Total Requests"
                value={(currentMetrics.requestsTotal ?? 0).toLocaleString()}
                icon={Activity}
              />
              <MetricsCard
                title="Requests/sec"
                value={formatValue(currentMetrics.requestsPerSecond)}
                icon={Activity}
              />
              <MetricsCard
                title="Avg Response Time"
                value={formatValue(currentMetrics.avgResponseTime)}
                unit="ms"
                icon={Activity}
              />
            </div>

            {/* 历史数据图表占位 */}
            {historyData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-slate-900">
                    History ({historyData.length} data points)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    Chart visualization (requires recharts integration)
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            No metrics data available. Make sure the metrics endpoint is enabled.
          </div>
        )}
      </div>
    </div>
  )
}

export default MonitoringPage
