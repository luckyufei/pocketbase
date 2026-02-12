/**
 * JobsFilters 组件
 * 任务筛选器 - 与 UI 版本对齐
 */
import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { JobsFilter } from '../store'

interface JobsFiltersProps {
  filter: JobsFilter
  onChange: (filter: Partial<JobsFilter>) => void
  onClear: () => void
  className?: string
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
]

const LIMIT_OPTIONS = [10, 20, 50, 100]

export function JobsFilters({ filter, onChange, onClear, className }: JobsFiltersProps) {
  const handleTopicChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ topic: e.target.value })
    },
    [onChange]
  )

  const handleStatusChange = useCallback(
    (value: string) => {
      onChange({ status: value === 'all' ? '' : value })
    },
    [onChange]
  )

  const handleLimitChange = useCallback(
    (value: string) => {
      onChange({ limit: parseInt(value, 10) })
    },
    [onChange]
  )

  return (
    <div className={cn('flex flex-wrap items-end gap-2.5', className)}>
      <div className="space-y-1">
        <Label htmlFor="filter-topic" className="text-xs font-medium">Topic</Label>
        <Input
          id="filter-topic"
          placeholder="Filter by topic..."
          value={filter.topic}
          onChange={handleTopicChange}
          className="h-[38px] w-[180px]"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-status" className="text-xs font-medium">Status</Label>
        <Select value={filter.status || 'all'} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-[38px] w-[140px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-limit" className="text-xs font-medium">Per Page</Label>
        <Select value={String(filter.limit)} onValueChange={handleLimitChange}>
          <SelectTrigger className="h-[38px] w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMIT_OPTIONS.map((limit) => (
              <SelectItem key={limit} value={String(limit)}>
                {limit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">&nbsp;</Label>
        <Button variant="secondary" size="sm" className="h-[38px]" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  )
}
