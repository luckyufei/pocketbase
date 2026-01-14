/**
 * TracesFilter - Trace 筛选器组件
 * 提供 HTTP 方法、状态码和搜索过滤功能
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

interface TracesFilters {
  method: string
  status: string
  search: string
}

interface TracesFilterProps {
  filters: TracesFilters
  onChange: (filters: TracesFilters) => void
}

const HTTP_METHODS = [
  { value: 'all', label: 'All Methods' },
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
]

const STATUS_CODES = [
  { value: 'all', label: 'All Status' },
  { value: '2xx', label: '2xx Success' },
  { value: '3xx', label: '3xx Redirect' },
  { value: '4xx', label: '4xx Client Error' },
  { value: '5xx', label: '5xx Server Error' },
]

export function TracesFilter({ filters, onChange }: TracesFilterProps) {
  const hasActiveFilters = filters.method !== '' || filters.status !== '' || filters.search !== ''

  const updateFilter = (key: keyof TracesFilters, value: string) => {
    // 将 'all' 转换回空字符串
    const actualValue = value === 'all' ? '' : value
    onChange({ ...filters, [key]: actualValue })
  }

  const clearFilters = () => {
    onChange({ method: '', status: '', search: '' })
  }

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* 搜索输入 */}
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          placeholder="Search traces..."
          className="pl-9"
        />
      </div>

      {/* 方法选择 */}
      <div className="flex items-center gap-2">
        <Label className="text-sm">Method</Label>
        <Select
          value={filters.method || 'all'}
          onValueChange={(value) => updateFilter('method', value)}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All Methods" />
          </SelectTrigger>
          <SelectContent>
            {HTTP_METHODS.map((method) => (
              <SelectItem key={method.value} value={method.value}>
                {method.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 状态选择 */}
      <div className="flex items-center gap-2">
        <Label className="text-sm">Status</Label>
        <Select
          value={filters.status || 'all'}
          onValueChange={(value) => updateFilter('status', value)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_CODES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
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
