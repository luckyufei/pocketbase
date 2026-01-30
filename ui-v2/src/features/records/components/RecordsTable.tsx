// T059: Records 表格组件
import { memo, useMemo } from 'react'
import type { RecordModel, SchemaField, CollectionModel } from 'pocketbase'
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
  collection?: CollectionModel | null
  selectedIds: Set<string>
  isAllSelected: boolean
  sortState: SortState | null
  onSort: (field: string) => void
  onSelect: (id: string) => void
  onSelectAll: () => void
  onRowClick: (record: RecordModel) => void
}

// 基础跳过的字段（在列表中不显示）
// id 和 created 是固定显示的，所以也要跳过
const BASE_SKIP_FIELDS = ['id', 'created', 'updated', 'collectionId', 'collectionName']

// Auth collection 额外跳过的字段（这些是内部字段）
const AUTH_SKIP_FIELDS = ['tokenKey', 'password']

// _superusers collection 额外跳过的字段
const SUPERUSERS_SKIP_FIELDS = ['verified', 'emailVisibility']

/**
 * Records 表格组件
 * 使用 React.memo 优化渲染性能
 */
export const RecordsTable = memo(function RecordsTable({
  records,
  fields,
  collection,
  selectedIds,
  isAllSelected,
  sortState,
  onSort,
  onSelect,
  onSelectAll,
  onRowClick,
}: RecordsTableProps) {
  const isAuthCollection = collection?.type === 'auth'
  const isSuperusers = collection?.name === '_superusers'

  // 计算要显示的字段
  const displayFields = useMemo(() => {
    let skipNames = [...BASE_SKIP_FIELDS]

    // Auth collection 跳过内部字段
    if (isAuthCollection) {
      skipNames = [...skipNames, ...AUTH_SKIP_FIELDS]
    }

    // _superusers 额外跳过 verified 和 emailVisibility
    if (isSuperusers) {
      skipNames = [...skipNames, ...SUPERUSERS_SKIP_FIELDS]
    }

    return fields.filter((f) => {
      // 跳过隐藏字段
      if (f.hidden) return false
      // 跳过 autodate 类型
      if (f.type === 'autodate') return false
      // 跳过指定名称的字段
      if (skipNames.includes(f.name)) return false
      return true
    })
  }, [fields, isAuthCollection, isSuperusers])

  // 找到 id 字段（primaryKey）
  const idField = fields.find((f) => f.name === 'id')

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

    if (value === null || value === undefined || value === '') {
      return <span className="text-muted-foreground">-</span>
    }

    switch (field.type) {
      case 'bool':
        return value ? '✓' : '✗'
      case 'date':
        return new Date(value).toLocaleDateString()
      case 'json':
        return (
          <code className="text-xs bg-muted px-1 py-0.5 rounded">
            {JSON.stringify(value).slice(0, 50)}...
          </code>
        )
      case 'file':
        if (Array.isArray(value)) {
          return value.length > 0 ? `${value.length} 个文件` : '-'
        }
        return value
      case 'relation':
        if (Array.isArray(value)) {
          return value.length > 0 ? `${value.length} 条关联` : '-'
        }
        return value
      case 'select':
        if (Array.isArray(value)) {
          return value.length > 0 ? value.join(', ') : '-'
        }
        return value
      case 'email':
        return <span className="text-blue-600">{String(value)}</span>
      default:
        return String(value).slice(0, 100)
    }
  }

  // 限制显示的列数（防止太多列）
  const visibleFields = displayFields.slice(0, 6)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox checked={isAllSelected} onCheckedChange={onSelectAll} aria-label="全选" />
          </TableHead>
          {/* id 列始终显示在最前面 */}
          <TableHead className="w-36">
            <Button variant="ghost" size="sm" className="h-8 -ml-3" onClick={() => onSort('id')}>
              id
              {renderSortIcon('id')}
            </Button>
          </TableHead>
          {/* 其他字段按顺序显示 */}
          {visibleFields.map((field) => (
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
          {/* 创建时间列 */}
          <TableHead className="w-36">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 -ml-3"
              onClick={() => onSort('created')}
            >
              created
              {renderSortIcon('created')}
            </Button>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={visibleFields.length + 3}
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
              <TableCell
                className="font-mono text-xs select-all cursor-pointer hover:bg-muted/50"
                onClick={(e) => {
                  e.stopPropagation()
                  navigator.clipboard.writeText(record.id)
                }}
                title="点击复制"
              >
                {record.id}
              </TableCell>
              {visibleFields.map((field) => (
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
