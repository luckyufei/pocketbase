/**
 * 集合差异对比表
 * 用于展示两个集合之间的差异（导入/更新时使用）
 */
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CollectionModel, SchemaField } from 'pocketbase'

interface CollectionsDiffTableProps {
  collectionA: Partial<CollectionModel>
  collectionB: Partial<CollectionModel>
  deleteMissing?: boolean
}

function hasChanges(valA: unknown, valB: unknown): boolean {
  if (valA === valB) return false
  return JSON.stringify(valA) !== JSON.stringify(valB)
}

function displayValue(value: unknown): string {
  if (typeof value === 'undefined') return ''
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}

function getFieldById(fields: SchemaField[] | undefined, id: string): SchemaField | null {
  return fields?.find((f) => f.id === id) || null
}

function mergeUnique<T>(arr1: T[], arr2: T[]): T[] {
  return [...new Set([...arr1, ...arr2])]
}

export function CollectionsDiffTable({
  collectionA = {},
  collectionB = {},
  deleteMissing = false,
}: CollectionsDiffTableProps) {
  const isDeleteDiff = !collectionB?.id && !collectionB?.name
  const isCreateDiff = !isDeleteDiff && !collectionA?.id

  const fieldsListA = useMemo(
    () => (Array.isArray(collectionA?.fields) ? [...collectionA.fields] : []),
    [collectionA?.fields]
  )

  const fieldsListB = useMemo(() => {
    let list = Array.isArray(collectionB?.fields) ? [...collectionB.fields] : []

    if (!deleteMissing) {
      list = list.concat(
        fieldsListA.filter((fieldA) => !list.find((fieldB) => fieldA.id === fieldB.id))
      )
    }

    return list
  }, [collectionB?.fields, deleteMissing, fieldsListA])

  const removedFields = fieldsListA.filter(
    (fieldA) => !fieldsListB.find((fieldB) => fieldA.id === fieldB.id)
  )

  const sharedFields = fieldsListB.filter((fieldB) =>
    fieldsListA.find((fieldA) => fieldA.id === fieldB.id)
  )

  const addedFields = fieldsListB.filter(
    (fieldB) => !fieldsListA.find((fieldA) => fieldA.id === fieldB.id)
  )

  const mainModelProps = mergeUnique(
    Object.keys(collectionA || {}),
    Object.keys(collectionB || {})
  ).filter((key) => !['fields', 'created', 'updated'].includes(key))

  const hasAnyChange =
    mainModelProps.some((prop) =>
      hasChanges(
        (collectionA as Record<string, unknown>)?.[prop],
        (collectionB as Record<string, unknown>)?.[prop]
      )
    ) ||
    removedFields.length > 0 ||
    addedFields.length > 0

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="flex items-center gap-2">
        {!collectionA?.id ? (
          <>
            <Badge variant="default" className="bg-green-500">
              新增
            </Badge>
            <strong>{collectionB?.name}</strong>
          </>
        ) : !collectionB?.id ? (
          <>
            <Badge variant="destructive">删除</Badge>
            <strong>{collectionA?.name}</strong>
          </>
        ) : (
          <>
            {hasAnyChange && (
              <Badge variant="secondary" className="bg-yellow-500 text-white">
                变更
              </Badge>
            )}
            {collectionA.name !== collectionB.name && (
              <>
                <strong className="line-through text-muted-foreground">{collectionA.name}</strong>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
            <strong>{collectionB.name}</strong>
          </>
        )}
      </div>

      {/* 差异表格 */}
      <div className="border-2 border-primary rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary">
              <TableHead className="text-primary-foreground">属性</TableHead>
              <TableHead className="text-primary-foreground w-[40%]">旧值</TableHead>
              <TableHead className="text-primary-foreground w-[40%]">新值</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* 主属性 */}
            {mainModelProps.map((prop) => {
              const oldVal = (collectionA as Record<string, unknown>)?.[prop]
              const newVal = (collectionB as Record<string, unknown>)?.[prop]
              const changed = hasChanges(oldVal, newVal)

              return (
                <TableRow key={prop} className={changed ? 'text-primary' : ''}>
                  <TableCell className="font-medium">{prop}</TableCell>
                  <TableCell
                    className={cn(
                      isCreateDiff ? 'bg-muted text-muted-foreground' : '',
                      !isCreateDiff && changed ? 'bg-red-50' : ''
                    )}
                  >
                    <pre className="text-xs whitespace-pre-wrap">{displayValue(oldVal)}</pre>
                  </TableCell>
                  <TableCell
                    className={cn(
                      isDeleteDiff ? 'bg-muted text-muted-foreground' : '',
                      !isDeleteDiff && changed ? 'bg-green-50' : ''
                    )}
                  >
                    <pre className="text-xs whitespace-pre-wrap">{displayValue(newVal)}</pre>
                  </TableCell>
                </TableRow>
              )
            })}

            {/* 删除的字段 */}
            {(deleteMissing || isDeleteDiff) &&
              removedFields.map((field) => (
                <>
                  <TableRow key={`header-${field.id}`}>
                    <TableCell colSpan={3} className="bg-muted font-medium">
                      字段: {field.name}
                      <Badge variant="destructive" className="ml-2">
                        删除 - 所有与 {field.name} 相关的数据将被删除！
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {Object.entries(field).map(([key, value]) => (
                    <TableRow key={`${field.id}-${key}`} className="text-primary">
                      <TableCell className="pl-8">{key}</TableCell>
                      <TableCell className="bg-red-50">
                        <pre className="text-xs whitespace-pre-wrap">{displayValue(value)}</pre>
                      </TableCell>
                      <TableCell className="bg-muted" />
                    </TableRow>
                  ))}
                </>
              ))}

            {/* 共享字段 */}
            {sharedFields.map((field) => {
              const oldField = getFieldById(fieldsListA, field.id)
              const fieldChanged = hasChanges(oldField, field)

              return (
                <>
                  <TableRow key={`header-${field.id}`}>
                    <TableCell colSpan={3} className="bg-muted font-medium">
                      字段: {field.name}
                      {fieldChanged && (
                        <Badge variant="secondary" className="ml-2 bg-yellow-500 text-white">
                          变更
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                  {Object.entries(field).map(([key, newValue]) => {
                    const oldValue = oldField?.[key as keyof SchemaField]
                    const propChanged = hasChanges(oldValue, newValue)

                    return (
                      <TableRow
                        key={`${field.id}-${key}`}
                        className={propChanged ? 'text-primary' : ''}
                      >
                        <TableCell className="pl-8">{key}</TableCell>
                        <TableCell className={propChanged ? 'bg-red-50' : ''}>
                          <pre className="text-xs whitespace-pre-wrap">
                            {displayValue(oldValue)}
                          </pre>
                        </TableCell>
                        <TableCell className={propChanged ? 'bg-green-50' : ''}>
                          <pre className="text-xs whitespace-pre-wrap">
                            {displayValue(newValue)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </>
              )
            })}

            {/* 新增字段 */}
            {addedFields.map((field) => (
              <>
                <TableRow key={`header-${field.id}`}>
                  <TableCell colSpan={3} className="bg-muted font-medium">
                    字段: {field.name}
                    <Badge variant="default" className="ml-2 bg-green-500">
                      新增
                    </Badge>
                  </TableCell>
                </TableRow>
                {Object.entries(field).map(([key, value]) => (
                  <TableRow key={`${field.id}-${key}`} className="text-primary">
                    <TableCell className="pl-8">{key}</TableCell>
                    <TableCell className="bg-muted" />
                    <TableCell className="bg-green-50">
                      <pre className="text-xs whitespace-pre-wrap">{displayValue(value)}</pre>
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
