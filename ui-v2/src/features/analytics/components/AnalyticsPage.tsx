/**
 * Analytics 页面
 * 流量分析仪表盘
 */
import { useEffect } from 'react'
import { useAnalytics } from '@/features/analytics'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, RefreshCw, Eye, Users, Clock, TrendingDown } from 'lucide-react'

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
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value}
          {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
        </div>
        {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
      </CardContent>
    </Card>
  )
}

// 格式化时长
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}m ${secs.toFixed(0)}s`
}

export function AnalyticsPage() {
  const { summary, historyData, isLoading, error, selectedRange, loadData, refresh, changeRange } =
    useAnalytics()

  useEffect(() => {
    loadData()
  }, [])

  // 当时间范围改变时重新加载
  useEffect(() => {
    loadData()
  }, [selectedRange])

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <header className="h-14 px-4 border-b flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex items-center gap-2">
            <Select value={selectedRange} onValueChange={(v) => changeRange(v as any)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
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
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-4">{error}</div>
        )}

        {isLoading && !summary ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : summary ? (
          <div className="space-y-6">
            {/* 指标卡片 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricsCard
                title="Page Views"
                value={summary.totalPageViews.toLocaleString()}
                icon={Eye}
              />
              <MetricsCard
                title="Unique Visitors"
                value={summary.totalUniqueVisitors.toLocaleString()}
                icon={Users}
              />
              <MetricsCard
                title="Avg Session Duration"
                value={formatDuration(summary.avgSessionDuration)}
                icon={Clock}
              />
              <MetricsCard
                title="Bounce Rate"
                value={summary.bounceRate.toFixed(1)}
                unit="%"
                icon={TrendingDown}
              />
            </div>

            {/* Top Pages */}
            {summary.topPages && summary.topPages.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Top Pages</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>URL</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Unique Views</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.topPages.map((page, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm truncate max-w-md">
                            {page.url}
                          </TableCell>
                          <TableCell className="text-right">
                            {page.views.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {page.uniqueViews.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Top Sources */}
            {summary.topSources && summary.topSources.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Top Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Visits</TableHead>
                        <TableHead className="text-right">Percentage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.topSources.map((source, index) => (
                        <TableRow key={index}>
                          <TableCell>{source.source}</TableCell>
                          <TableCell className="text-right">
                            {source.visits.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {source.percentage.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* 历史数据图表占位 */}
            {historyData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>History ({historyData.length} data points)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    Chart visualization (requires recharts integration)
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No analytics data available. Make sure the analytics endpoint is enabled.
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalyticsPage
