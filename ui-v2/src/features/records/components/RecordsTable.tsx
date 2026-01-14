// T059: Records 表格组件
import { memo, useCallback } from 'react'
import type { RecordModel, SchemaField } from 'pocketbase'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SortState } from '../store'

interface RecordsTableProps {
  records: RecordModel[]
  fields: SchemaField[]
  selectedIds: Set<string>
  isAllSelected: boolean
  sortState: SortState | null
  onSort: (field: string) => void
  onSelect: (id: string) => void
  onSelectAll: () => void
  onRowClick: (record: RecordModel) => void
}

/**
 * Records 表格组件
 * 使用 React.memo 优化渲染性能
 */
export const RecordsTable = memo(function RecordsTable({
  records,
  fields,
  selectedIds,
  isAllSelected,
  sortState,
  onSort,
  onSelect,
  onSelectAll,
  onRowClick,
}: RecordsTableProps) {
  const renderSortIcon = (field: string) => {
    if (sortState?.field !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3" />
    }
    return sortState.direction === 'asc' ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    )
  }

  const renderCellValue = (record: RecordModel, field: SchemaField) => {
    const value = record[field.name]

    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">-</span>
    }

    switch (field.type) {
      case 'bool':
        return value ? '是' : '否'
      case 'date':
        return new Date(value).toLocaleDateString()
      case 'json':
        return (
          <code className="text-xs bg-muted px-1 py-0.5 rounded">
            {JSON.stringify(value).slice(0, 50)}...
          </code>
        )
      case 'file':
        return Array.isArray(value) ? `${value.length} 个文件` : value
      case 'relation':
        return Array.isArray(value) ? `${value.length} 条关联` : value
      case 'select':
        return Array.isArray(value) ? value.join(', ') : value
      default:
        return String(value).slice(0, 100)
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox checked={isAllSelected} onCheckedChange={onSelectAll} aria-label="全选" />
          </TableHead>
          <TableHead className="w-32">
            <Button variant="ghost" size="sm" className="h-8 -ml-3" onClick={() => onSort('id')}>
              ID
              {renderSortIcon('id')}
            </Button>
          </TableHead>
          {fields.slice(0, 5).map((field) => (
            <TableHead key={field.name}>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 -ml-3"
                onClick={() => onSort(field.name)}
              >
                {field.name}
                {renderSortIcon(field.name)}
              </Button>
            </TableHead>
          ))}
          <TableHead className="w-32">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 -ml-3"
              onClick={() => onSort('created')}
            >
              创建时间
              {renderSortIcon('created')}
            </Button>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={fields.length + 3}
              className="h-32 text-center text-muted-foreground"
            >
              暂无数据
            </TableCell>
          </TableRow>
        ) : (
          records.map((record) => (
            <TableRow
              key={record.id}
              className={cn('cursor-pointer', selectedIds.has(record.id) && 'bg-muted/50')}
              onClick={() => onRowClick(record)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(record.id)}
                  onCheckedChange={() => onSelect(record.id)}
                  aria-label={`选择 ${record.id}`}
                />
              </TableCell>
              <TableCell className="font-mono text-xs">{record.id.slice(0, 8)}...</TableCell>
              {fields.slice(0, 5).map((field) => (
                <TableCell key={field.name} className="max-w-[200px] truncate">
                  {renderCellValue(record, field)}
                </TableCell>
              ))}
              <TableCell className="text-xs text-muted-foreground">
                {new Date(record.created).toLocaleString()}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
})

export default RecordsTable
