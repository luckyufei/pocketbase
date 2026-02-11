// T059: Records 表格组件 - 与 UI 版本一致，支持 Toggle columns 和行编辑按钮
// 左侧复选框列和右侧操作列使用 position: sticky 固定
import { memo, useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useAtomValue } from 'jotai'
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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SortState } from '../store'
import { superuserAtom } from '@/store/auth'

// Sticky 列的样式类名
// 左侧固定列（复选框）
const stickyLeftClass = 'sticky left-0 z-10 bg-background'
const stickyLeftHeaderClass = 'sticky left-0 z-20 bg-background'
// 右侧固定列（操作按钮）
const stickyRightClass = 'sticky right-0 z-10 bg-background'
const stickyRightHeaderClass = 'sticky right-0 z-20 bg-background'

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
const BASE_SKIP_FIELDS = ['collectionId', 'collectionName']

// Auth collection 额外跳过的字段（这些是内部字段）
const AUTH_SKIP_FIELDS = ['tokenKey', 'password']

// _superusers collection 额外跳过的字段
const SUPERUSERS_SKIP_FIELDS = ['verified', 'emailVisibility']

/**
 * Records 表格组件
 * 使用 React.memo 优化渲染性能
 * 与 UI 版本一致：
 * - 支持 Toggle columns（列显隐切换）
 * - 每行末尾有编辑箭头按钮
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
  const isViewCollection = collection?.type === 'view'

  // 获取当前登录用户，用于在 _superusers 表中标识当前用户
  const currentUser = useAtomValue(superuserAtom)

  // 隐藏列状态 - 存储字段 id
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])

  // localStorage key
  const hiddenColumnsKey = collection?.id ? `${collection.id}@hiddenColumns` : ''

  // 从 localStorage 加载隐藏列设置
  useEffect(() => {
    if (!hiddenColumnsKey) return
    try {
      const stored = localStorage.getItem(hiddenColumnsKey)
      if (stored) {
        setHiddenColumns(JSON.parse(stored) || [])
      } else {
        setHiddenColumns([])
      }
    } catch {
      setHiddenColumns([])
    }
  }, [hiddenColumnsKey])

  // 保存隐藏列设置到 localStorage
  const updateHiddenColumns = useCallback((columns: string[]) => {
    setHiddenColumns(columns)
    if (!hiddenColumnsKey) return
    if (columns.length > 0) {
      localStorage.setItem(hiddenColumnsKey, JSON.stringify(columns))
    } else {
      localStorage.removeItem(hiddenColumnsKey)
    }
  }, [hiddenColumnsKey])

  // 计算所有可显示的字段（排除内部字段）
  const allDisplayFields = useMemo(() => {
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
      // 跳过指定名称的字段
      if (skipNames.includes(f.name)) return false
      return true
    })
  }, [fields, isAuthCollection, isSuperusers])

  // 可切换显隐的字段（排除 id/primaryKey）
  const toggleableFields = useMemo(() => {
    return allDisplayFields.filter((f) => !f.primaryKey)
  }, [allDisplayFields])

  // 当前可见的字段（排除隐藏的）
  const visibleFields = useMemo(() => {
    return allDisplayFields.filter((f) => !hiddenColumns.includes(f.id))
  }, [allDisplayFields, hiddenColumns])

  // 切换列显隐
  const toggleColumn = useCallback((fieldId: string, visible: boolean) => {
    if (visible) {
      updateHiddenColumns(hiddenColumns.filter((id) => id !== fieldId))
    } else {
      updateHiddenColumns([...hiddenColumns, fieldId])
    }
  }, [hiddenColumns, updateHiddenColumns])

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

    // ID 字段特殊处理：在 _superusers 表中为当前用户添加 "You" 标签（与 UI 版本一致）
    if (field.name === 'id' && isSuperusers && currentUser?.id === record.id) {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span>{String(value)}</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            You
          </span>
        </span>
      )
    }

    switch (field.type) {
      case 'bool':
        return (
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
            value ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
          )}>
            {value ? 'True' : 'False'}
          </span>
        )
      case 'date':
        return new Date(value).toLocaleDateString()
      case 'autodate':
        return new Date(value).toLocaleString()
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

  // 表格容器 ref，用于检测水平滚动状态
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const [scrollState, setScrollState] = useState({ isScrolling: false, isAtStart: true, isAtEnd: false })

  // 监听滚动事件，更新滚动状态
  useEffect(() => {
    const container = tableContainerRef.current
    if (!container) return

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container
      const hasHorizontalScroll = scrollWidth > clientWidth
      const isAtStart = scrollLeft <= 0
      const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 1

      setScrollState({
        isScrolling: hasHorizontalScroll,
        isAtStart,
        isAtEnd,
      })
    }

    // 初始检查
    checkScroll()

    // 监听滚动和 resize
    container.addEventListener('scroll', checkScroll)
    window.addEventListener('resize', checkScroll)

    return () => {
      container.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [records, visibleFields])

  // 根据滚动状态计算阴影样式
  const leftShadowClass = scrollState.isScrolling && !scrollState.isAtStart
    ? 'shadow-[3px_0_5px_0_rgba(0,0,0,0.1)]'
    : ''
  const rightShadowClass = scrollState.isScrolling && !scrollState.isAtEnd
    ? 'shadow-[-3px_0_5px_0_rgba(0,0,0,0.1)]'
    : ''

  return (
    <div ref={tableContainerRef} className="overflow-x-auto">
      <Table>
        <TableHeader className="sticky top-0 z-30 bg-background">
          <TableRow>
            {/* 复选框列 - 固定在左侧，View Collection 不显示 */}
            {!isViewCollection && (
              <TableHead className={cn('w-[70px] min-w-[70px]', stickyLeftHeaderClass, leftShadowClass)}>
                <Checkbox checked={isAllSelected} onCheckedChange={onSelectAll} aria-label="全选" />
              </TableHead>
            )}
            {/* 可见字段列 */}
            {visibleFields.map((field) => (
              <TableHead key={field.name} className="whitespace-nowrap">
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
            {/* Toggle columns 按钮列 - 固定在右侧 */}
            <TableHead className={cn('w-12 min-w-12', stickyRightHeaderClass, rightShadowClass)}>
              {toggleableFields.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label="Toggle columns"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="end">
                    <div className="text-sm text-muted-foreground mb-3">Toggle columns</div>
                    <div className="space-y-2">
                      {toggleableFields.map((field) => (
                        <div key={field.id} className="flex items-center justify-between">
                          <Label htmlFor={`col-${field.id}`} className="text-sm font-normal cursor-pointer">
                            {field.name}
                          </Label>
                          <Switch
                            id={`col-${field.id}`}
                            checked={!hiddenColumns.includes(field.id)}
                            onCheckedChange={(checked) => toggleColumn(field.id, checked)}
                          />
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={visibleFields.length + (isViewCollection ? 1 : 2)}
                className="h-32 text-center text-muted-foreground"
              >
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            records.map((record) => (
              <TableRow
                key={record.id}
                className={cn('cursor-pointer group', selectedIds.has(record.id) && 'bg-muted/50')}
                onClick={() => onRowClick(record)}
              >
                {/* 复选框列 - 固定在左侧，View Collection 不显示 */}
                {!isViewCollection && (
                  <TableCell 
                    className={cn('w-[70px] min-w-[70px]', stickyLeftClass, leftShadowClass)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedIds.has(record.id)}
                      onCheckedChange={() => onSelect(record.id)}
                      aria-label={`选择 ${record.id}`}
                    />
                  </TableCell>
                )}
                {/* 可见字段值 */}
                {visibleFields.map((field) => (
                  <TableCell 
                    key={field.name} 
                    className={cn(
                      'max-w-[200px] truncate whitespace-nowrap',
                      field.name === 'id' && 'font-mono text-xs'
                    )}
                    onClick={(e) => {
                      // id 字段点击复制
                      if (field.name === 'id') {
                        e.stopPropagation()
                        navigator.clipboard.writeText(record.id)
                      }
                    }}
                    title={field.name === 'id' ? '点击复制' : undefined}
                  >
                    {renderCellValue(record, field)}
                  </TableCell>
                ))}
                {/* 行编辑按钮 - 固定在右侧，与 UI 版本一致 */}
                <TableCell className={cn('w-12 min-w-12', stickyRightClass, rightShadowClass)}>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
})

export default RecordsTable
