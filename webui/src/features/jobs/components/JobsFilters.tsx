/**
 * JobsFilters 组件
 * 任务筛选器
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
  { value: '', label: '全部状态' },
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
      onChange({ status: value })
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
    <div className={cn('flex flex-wrap items-end gap-4', className)}>
      <div className="space-y-1.5">
        <Label htmlFor="filter-topic">Topic</Label>
        <Input
          id="filter-topic"
          placeholder="按 topic 筛选..."
          value={filter.topic}
          onChange={handleTopicChange}
          className="w-[180px]"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-status">状态</Label>
        <Select value={filter.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value || 'all'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-limit">每页条数</Label>
        <Select value={String(filter.limit)} onValueChange={handleLimitChange}>
          <SelectTrigger className="w-[100px]">
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

      <Button variant="outline" onClick={onClear}>
        清除
      </Button>
    </div>
  )
}
