/**
 * Trace 过滤器
 * 时间范围、操作名称、状态、Trace ID 过滤
 */
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RotateCcw } from 'lucide-react'
import type { TraceFilters as TraceFiltersType, SpanStatus } from '../store'

interface Props {
  filters: TraceFiltersType
  timeRange: '1h' | '6h' | '24h' | '7d'
  onFiltersChange: (filters: TraceFiltersType) => void
  onTimeRangeChange: (range: '1h' | '6h' | '24h' | '7d') => void
}

const timeRanges = [
  { label: '1小时', value: '1h' },
  { label: '6小时', value: '6h' },
  { label: '24小时', value: '24h' },
  { label: '7天', value: '7d' },
] as const

const statusOptions = [
  { label: '全部', value: 'all' },
  { label: '成功', value: 'OK' },
  { label: '错误', value: 'ERROR' },
] as const

export function TraceFilters({ filters, timeRange, onFiltersChange, onTimeRangeChange }: Props) {
  const handleOperationChange = (value: string) => {
    onFiltersChange({ ...filters, operation: value })
  }

  const handleStatusChange = (value: string) => {
    onFiltersChange({ ...filters, status: value as SpanStatus | '' })
  }

  const handleTraceIdChange = (value: string) => {
    onFiltersChange({ ...filters, trace_id: value })
  }

  const handleReset = () => {
    onFiltersChange({})
    onTimeRangeChange('24h')
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* 时间范围 */}
      <div className="flex rounded-lg overflow-hidden border border-slate-200">
        {timeRanges.map((range) => (
          <button
            key={range.value}
            type="button"
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              timeRange === range.value
                ? 'bg-blue-500 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => onTimeRangeChange(range.value)}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* 操作名称 */}
      <Input
        type="text"
        placeholder="操作名称..."
        value={filters.operation || ''}
        onChange={(e) => handleOperationChange(e.target.value)}
        className="w-40 h-8 text-sm"
      />

      {/* 状态 */}
      <Select value={filters.status || 'all'} onValueChange={(v) => handleStatusChange(v === 'all' ? '' : v)}>
        <SelectTrigger className="w-24 h-8 text-sm">
          <SelectValue placeholder="状态" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Trace ID */}
      <Input
        type="text"
        placeholder="Trace ID..."
        value={filters.trace_id || ''}
        onChange={(e) => handleTraceIdChange(e.target.value)}
        className="w-36 h-8 text-sm font-mono"
      />

      {/* 重置 */}
      <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 px-2">
        <RotateCcw className="w-4 h-4" />
      </Button>
    </div>
  )
}
