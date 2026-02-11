/**
 * 记录信息内容组件
 * 展示记录的主要标识信息（如邮箱、用户名或 ID）
 * 支持显示 presentable 字段、文件缩略图、关联记录展开
 * 
 * 与旧版 UI 完全一致
 */
import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import type { RecordModel, CollectionModel } from 'pocketbase'
import { collectionsAtom } from '@/features/collections/store'
import { RecordFileThumb } from './RecordFileThumb'

interface RecordInfoContentProps {
  record: RecordModel
}

/**
 * 将值转换为数组
 */
function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value
  if (value !== undefined && value !== null) return [value]
  return []
}

/**
 * 检查值是否为空
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (typeof value === 'object' && Object.keys(value).length === 0) return true
  return false
}

/**
 * 将值转换为字符串
 */
function stringifyValue(value: unknown, missingValue = 'N/A'): string {
  if (isEmpty(value)) return missingValue

  if (typeof value === 'boolean') {
    return value ? 'True' : 'False'
  }

  if (typeof value === 'number') {
    return value.toString()
  }

  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((v) => stringifyValue(v, '')).filter(Boolean).join(', ')
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

/**
 * 截断字符串
 */
function truncate(str: string, maxLength = 70, suffix = '...'): string {
  if (!str || str.length <= maxLength) return str
  return str.substring(0, maxLength) + suffix
}

/**
 * 获取记录的显示值
 * 优先使用 displayFields，否则使用 fallback 属性列表
 */
function displayValue(
  model: Record<string, unknown>,
  displayFields: string[] = [],
  missingValue = 'N/A'
): string {
  const result: string[] = []

  for (const prop of displayFields) {
    const val = model[prop]
    if (val === undefined) continue
    const strVal = stringifyValue(val, missingValue)
    result.push(strVal)
  }

  if (result.length > 0) {
    return result.join(', ')
  }

  // Fallback 属性列表 - 与旧版 CommonHelper.displayValue 完全一致
  const fallbackProps = [
    'title',
    'name',
    'slug',
    'email',      // email 优先于 username
    'username',
    'nickname',
    'label',
    'heading',
    'message',
    'key',
    'identifier',
    'id',
  ]

  for (const prop of fallbackProps) {
    const val = stringifyValue(model[prop] as unknown, '')
    if (val) return val
  }

  return missingValue
}

/**
 * GeoPoint 值显示组件
 */
function GeoPointValue({ value }: { value: { lon?: number; lat?: number } }) {
  if (!value || (value.lon === undefined && value.lat === undefined)) {
    return <span className="text-slate-400">N/A</span>
  }

  return (
    <span className="text-slate-600">
      {value.lon?.toFixed(6) ?? 0}, {value.lat?.toFixed(6) ?? 0}
    </span>
  )
}

export function RecordInfoContent({ record }: RecordInfoContentProps) {
  const collections = useAtomValue(collectionsAtom)

  // 查找对应的 collection
  const collection = useMemo(() => {
    return collections?.find((item) => item.id === record?.collectionId)
  }, [collections, record?.collectionId])

  // 获取 presentable 的非文件字段
  const nonFileDisplayFields = useMemo(() => {
    const fields = collection?.fields || []
    return fields.filter((f) => !f.hidden && f.presentable && f.type !== 'file')
  }, [collection])

  // 获取 presentable 的文件字段
  const fileDisplayFields = useMemo(() => {
    const fields = collection?.fields || []
    const presentableFileFields = fields.filter(
      (f) => !f.hidden && f.presentable && f.type === 'file'
    )

    // 只有当 fileDisplayFields 和 nonFileDisplayFields 都为空时，
    // 才回退到第一个单文件图片字段（与旧版逻辑一致）
    if (presentableFileFields.length === 0 && nonFileDisplayFields.length === 0) {
      const fallbackFileField = fields.find((f) => {
        return (
          !f.hidden &&
          f.type === 'file' &&
          f.maxSelect === 1 &&
          f.mimeTypes?.some((t: string) => t.startsWith('image/'))
        )
      })
      if (fallbackFileField) {
        return [fallbackFileField]
      }
    }

    return presentableFileFields
  }, [collection, nonFileDisplayFields.length])

  // 没有 collection 信息时，使用简单显示（与旧版优先级一致）
  if (!collection) {
    const simpleDisplayValue =
      record.title || record.name || record.slug || record.email || record.username || record.id || 'N/A'
    return (
      <span className="truncate text-sm" title={simpleDisplayValue}>
        {simpleDisplayValue}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {/* 文件缩略图 */}
      {fileDisplayFields.map((field) => {
        const filenames = toArray(record[field.name] as string | string[]).slice(0, 5)
        return filenames.map((filename) => {
          if (isEmpty(filename)) return null
          return (
            <RecordFileThumb
              key={`${field.name}-${filename}`}
              record={record}
              filename={filename}
              size="sm"
              className="w-6 h-6 flex-shrink-0"
            />
          )
        })
      })}

      {/* 非文件字段 */}
      <div className="flex items-center gap-1 min-w-0 truncate text-sm">
        {nonFileDisplayFields.length > 0 ? (
          nonFileDisplayFields.map((field, i) => {
            // 关联字段：显示展开的记录
            if (field.type === 'relation' && record.expand?.[field.name]) {
              const isMultiple = Array.isArray(record.expand?.[field.name])
              const expanded = toArray(record.expand?.[field.name] as RecordModel | RecordModel[])

              return (
                <span key={field.name} className="inline-flex items-center gap-0.5 truncate">
                  {i > 0 && <span className="text-slate-400 mx-1">•</span>}
                  {isMultiple && <span className="text-slate-400">[</span>}
                  {expanded.slice(0, 2).map((expandRecord, j) => (
                    <span key={expandRecord.id}>
                      {j > 0 && <span className="text-slate-400 mx-0.5">|</span>}
                      <RecordInfoContent record={expandRecord} />
                    </span>
                  ))}
                  {expanded.length > 2 && (
                    <>
                      <span className="text-slate-400 mx-0.5">|</span>
                      <small className="text-slate-400">({expanded.length - 2} more)</small>
                    </>
                  )}
                  {isMultiple && <span className="text-slate-400">]</span>}
                </span>
              )
            }

            // GeoPoint 字段
            if (field.type === 'geoPoint') {
              return (
                <span key={field.name} className="inline-flex items-center truncate">
                  {i > 0 && <span className="text-slate-400 mx-1">•</span>}
                  <GeoPointValue value={record[field.name] as { lon?: number; lat?: number }} />
                </span>
              )
            }

            // 其他字段
            return (
              <span key={field.name} className="truncate">
                {i > 0 && <span className="text-slate-400 mx-1">•</span>}
                <span>{truncate(displayValue(record, [field.name]), 70)}</span>
              </span>
            )
          })
        ) : (
          // 没有 presentable 字段时，使用 displayValue 的 fallback 逻辑
          <span className="truncate">{truncate(displayValue(record, []), 70)}</span>
        )}
      </div>
    </div>
  )
}
