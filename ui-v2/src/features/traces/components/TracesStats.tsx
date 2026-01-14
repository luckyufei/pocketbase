/**
 * TracesStats - Trace 统计组件
 * 显示请求追踪的统计信息
 */
import { Card, CardContent } from '@/components/ui/card'
import { Activity, Clock, AlertTriangle, CheckCircle } from 'lucide-react'

interface TracesStatsData {
  totalRequests: number
  avgDuration: number
  errorRate: number
  successRate: number
}

interface TracesStatsProps {
  stats: TracesStatsData
}

export function TracesStats({ stats }: TracesStatsProps) {
  const statItems = [
    {
      label: 'Total Requests',
      value: stats.totalRequests.toLocaleString(),
      icon: Activity,
      color: 'text-blue-500',
    },
    {
      label: 'Avg Duration',
      value: `${stats.avgDuration}ms`,
      icon: Clock,
      color: 'text-yellow-500',
    },
    {
      label: 'Error Rate',
      value: `${stats.errorRate}%`,
      icon: AlertTriangle,
      color: 'text-red-500',
    },
    {
      label: 'Success Rate',
      value: `${stats.successRate}%`,
      icon: CheckCircle,
      color: 'text-green-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <item.icon className={`h-8 w-8 ${item.color}`} />
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-xl font-bold">{item.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
