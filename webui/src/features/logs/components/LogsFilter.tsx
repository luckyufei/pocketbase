/**
 * LogsFilter - 日志筛选器组件
 * 提供日志级别和搜索过滤功能
 */
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Search } from 'lucide-react'

interface LogsFilters {
  level: string
  search: string
}

interface LogsFilterProps {
  filters: LogsFilters
  onChange: (filters: LogsFilters) => void
}

const LOG_LEVELS = [
  { value: 'all', label: 'All Levels' },
  { value: 'debug', label: 'Debug' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warning' },
  { value: 'error', label: 'Error' },
]

export function LogsFilter({ filters, onChange }: LogsFilterProps) {
  const hasActiveFilters = filters.level !== '' || filters.search !== ''

  const updateFilter = (key: keyof LogsFilters, value: string) => {
    // 将 'all' 转换回空字符串
    const actualValue = value === 'all' ? '' : value
    onChange({ ...filters, [key]: actualValue })
  }

  const clearFilters = () => {
    onChange({ level: '', search: '' })
  }

  return (
    <div className="flex items-center gap-4">
      {/* 搜索输入 */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          placeholder="Search logs..."
          className="pl-9"
        />
      </div>

      {/* 级别选择 */}
      <div className="flex items-center gap-2">
        <Label className="text-sm">Level</Label>
        <Select
          value={filters.level || 'all'}
          onValueChange={(value) => updateFilter('level', value)}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            {LOG_LEVELS.map((level) => (
              <SelectItem key={level.value} value={level.value}>
                {level.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 清除按钮 */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  )
}
