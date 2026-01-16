/**
 * T083: ServerlessMetrics - Serverless 指标组件
 * 显示 Serverless 环境下的运行指标
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Cloud, Clock, Zap, Database, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ServerlessMetricsData {
  coldStarts: number
  warmStarts: number
  avgColdStartTime: number // ms
  avgWarmStartTime: number // ms
  invocations: number
  errors: number
  memoryUsed: number // MB
  memoryLimit: number // MB
  executionTime: number // ms
  timeout: number // ms
}

interface ServerlessMetricsProps {
  data: ServerlessMetricsData
  className?: string
}

export function ServerlessMetrics({ data, className }: ServerlessMetricsProps) {
  const coldStartPercentage = data.invocations > 0 ? (data.coldStarts / data.invocations) * 100 : 0

  const errorRate = data.invocations > 0 ? (data.errors / data.invocations) * 100 : 0

  const memoryUsagePercentage =
    data.memoryLimit > 0 ? (data.memoryUsed / data.memoryLimit) * 100 : 0

  const executionPercentage = data.timeout > 0 ? (data.executionTime / data.timeout) * 100 : 0

  return (
    <div className={cn('space-y-4', className)}>
      {/* 调用统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Invocations</p>
                <p className="text-xl font-bold">{data.invocations.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Cloud className="h-8 w-8 text-cyan-500" />
              <div>
                <p className="text-sm text-muted-foreground">Cold Starts</p>
                <p className="text-xl font-bold">{data.coldStarts.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{coldStartPercentage.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Warm Starts</p>
                <p className="text-xl font-bold">{data.warmStarts.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-xl font-bold">{data.errors.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{errorRate.toFixed(2)}% error rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 启动时间 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Startup Times</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg Cold Start</span>
              <span className="font-medium">{data.avgColdStartTime}ms</span>
            </div>
            <Progress value={Math.min((data.avgColdStartTime / 5000) * 100, 100)} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg Warm Start</span>
              <span className="font-medium">{data.avgWarmStartTime}ms</span>
            </div>
            <Progress value={Math.min((data.avgWarmStartTime / 1000) * 100, 100)} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* 资源使用 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {data.memoryUsed}MB / {data.memoryLimit}MB
              </span>
              <Badge variant={memoryUsagePercentage > 80 ? 'destructive' : 'secondary'}>
                {memoryUsagePercentage.toFixed(1)}%
              </Badge>
            </div>
            <Progress
              value={memoryUsagePercentage}
              className={cn('h-2', memoryUsagePercentage > 80 && '[&>div]:bg-destructive')}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Execution Time
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {data.executionTime}ms / {data.timeout}ms timeout
              </span>
              <Badge variant={executionPercentage > 80 ? 'destructive' : 'secondary'}>
                {executionPercentage.toFixed(1)}%
              </Badge>
            </div>
            <Progress
              value={executionPercentage}
              className={cn('h-2', executionPercentage > 80 && '[&>div]:bg-destructive')}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ServerlessMetrics
