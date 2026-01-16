/**
 * DevicesPie - 设备分布饼图组件
 * 显示访问设备的分布情况
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Monitor, Smartphone, Tablet } from 'lucide-react'

interface DeviceData {
  device: string
  count: number
  percentage: number
}

interface DevicesPieProps {
  data: DeviceData[]
}

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  Desktop: Monitor,
  Mobile: Smartphone,
  Tablet: Tablet,
}

// 使用统一的 slate 灰色系 + 蓝色点缀
const DEVICE_COLORS = [
  'bg-blue-500',
  'bg-slate-500',
  'bg-slate-400',
  'bg-slate-600',
  'bg-slate-300',
]

export function DevicesPie({ data }: DevicesPieProps) {
  if (data.length === 0) {
    return (
      <Card data-testid="devices-pie">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Devices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-testid="devices-pie">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Devices</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((item, index) => {
            const Icon = DEVICE_ICONS[item.device] || Monitor
            const color = DEVICE_COLORS[index % DEVICE_COLORS.length]

            return (
              <div key={item.device} className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-slate-400" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-900">{item.device}</span>
                    <span className="text-sm text-slate-500">{item.percentage}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
