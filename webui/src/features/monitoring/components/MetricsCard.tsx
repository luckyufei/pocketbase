/**
 * MetricsCard - 指标卡片组件
 * 与 ui 版本 MetricsCard.svelte 一致
 */
import { Cpu, HardDrive, Layers, Timer, AlertTriangle } from 'lucide-react'

interface MetricsCardProps {
  title: string
  value: string | number
  unit?: string
  icon?: 'cpu' | 'memory' | 'stack' | 'timer' | 'warning' | 'database' | 'link' | 'page'
}

const iconMap = {
  cpu: Cpu,
  memory: HardDrive,
  stack: Layers,
  timer: Timer,
  warning: AlertTriangle,
  database: HardDrive,
  link: Layers,
  page: Layers,
}

export function MetricsCard({ title, value, unit, icon = 'cpu' }: MetricsCardProps) {
  const Icon = iconMap[icon] || Cpu

  return (
    <div className="flex-1 min-w-[160px] bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
        <Icon className="w-4 h-4" />
        <span>{title}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">
        {value}
        {unit && <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>}
      </div>
    </div>
  )
}

export default MetricsCard
