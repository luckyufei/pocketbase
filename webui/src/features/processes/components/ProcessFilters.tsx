/**
 * ProcessFilters 组件
 * 进程筛选器
 */
import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProcessFilter, ProcessStatus } from '../types'

interface ProcessFiltersProps {
  filter: ProcessFilter
  onChange: (filter: ProcessFilter) => void
  onClear: () => void
}

export function ProcessFilters({ filter, onChange, onClear }: ProcessFiltersProps) {
  const { t } = useTranslation()

  const handleStatusChange = (value: string) => {
    onChange({ ...filter, status: value as ProcessStatus | 'all' })
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filter, search: e.target.value })
  }

  const hasFilter = filter.status !== 'all' || filter.search !== ''

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* 状态筛选 */}
      <Select value={filter.status} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder={t('processes.filter.status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('processes.filter.allStatus')}</SelectItem>
          <SelectItem value="running">{t('processes.status.running')}</SelectItem>
          <SelectItem value="stopped">{t('processes.status.stopped')}</SelectItem>
          <SelectItem value="crashed">{t('processes.status.crashed')}</SelectItem>
          <SelectItem value="starting">{t('processes.status.starting')}</SelectItem>
        </SelectContent>
      </Select>

      {/* 搜索框 */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('processes.filter.searchPlaceholder')}
          value={filter.search}
          onChange={handleSearchChange}
          className="pl-9"
        />
      </div>

      {/* 清除按钮 */}
      {hasFilter && (
        <Button variant="ghost" size="sm" onClick={onClear} className="shrink-0">
          <X className="h-4 w-4 mr-1" />
          {t('processes.filter.clear')}
        </Button>
      )}
    </div>
  )
}
