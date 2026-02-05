/**
 * 集合查询标签页
 * 用于 View 类型集合的 SQL 查询编辑
 * 
 * Phase 0.8: SQL 编辑器增强
 * - SQL 语法高亮
 * - 表名/列名自动补全
 */
import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CodeEditor } from '@/components/CodeEditor'
import { extractColumnsFromQuery, sentenize } from '@/lib/utils'
import { collectionsAtom } from '../store'
import type { CollectionModel, SchemaField } from 'pocketbase'

interface CollectionQueryTabProps {
  collection: CollectionModel & { viewQuery?: string }
  onChange: (viewQuery: string) => void
  errors?: Record<string, unknown>
}

export function CollectionQueryTab({ collection, onChange, errors = {} }: CollectionQueryTabProps) {
  // 获取所有 collections 用于 SQL 自动补全
  const collections = useAtomValue(collectionsAtom)
  
  // 构建 SQL schema 用于自动补全
  const sqlSchema = useMemo(() => {
    const tables = collections.map((c: CollectionModel) => ({
      name: c.name,
      columns: (c as any).fields?.map((f: SchemaField) => f.name) || [],
    }))
    return { tables }
  }, [collections])
  
  // 解析字段错误
  const fieldsErrors = useMemo(() => {
    const result: string[] = []
    const raw = errors?.fields as
      | Record<string, Record<string, { message: string }>>
      | { message?: string }
      | undefined
    
    // viewQuery 错误
    const viewQueryError = errors?.viewQuery as { message?: string } | string | undefined
    if (viewQueryError) {
      if (typeof viewQueryError === 'string') {
        result.push(viewQueryError)
      } else if (viewQueryError.message) {
        result.push(viewQueryError.message)
      }
    }

    if (!raw) return result

    // 通用字段列表错误
    if ('message' in raw && raw.message) {
      result.push(raw.message)
      return result
    }

    // 单个字段错误
    const columns = extractColumnsFromQuery(collection?.viewQuery || '')
    // 移除基础系统字段
    const filteredColumns = columns.filter((c) => !['id', 'created', 'updated'].includes(c))

    for (const idx in raw) {
      if (idx === 'message') continue
      const fieldErrors = raw[idx as keyof typeof raw]
      if (typeof fieldErrors === 'object' && fieldErrors !== null) {
        for (const key in fieldErrors) {
          const message = (fieldErrors as Record<string, { message: string }>)[key]?.message
          const fieldName = filteredColumns[parseInt(idx)] || idx
          result.push(sentenize(`${fieldName}: ${message}`))
        }
      }
    }

    return result
  }, [errors, collection?.viewQuery])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="viewQuery">
          SELECT query <span className="text-destructive">*</span>
        </Label>

        <CodeEditor
          id="viewQuery"
          language="sql"
          placeholder="eg. SELECT id, name from posts"
          value={collection.viewQuery || ''}
          onChange={onChange}
          minHeight={150}
          sqlSchema={sqlSchema}
          className={fieldsErrors.length > 0 ? 'border-destructive' : ''}
        />

        <div className="text-sm text-muted-foreground space-y-1">
          <ul className="list-disc list-inside space-y-1">
            <li>
              Wildcard columns (<code>*</code>) are not supported.
            </li>
            <li>
              The query must have a unique <code>id</code> column.
              <br />
              If the query doesn't have a suitable one, you can create such using <code>(ROW_NUMBER() OVER()) as id</code>
            </li>
            <li>
              Expressions must use a valid format for a field name alias, eg. <code>MAX(balance) as maxBalance</code>
            </li>
            <li>
              Composite/multi-space expressions must be wrapped in parenthesis, eg. <code>(MAX(balance) + 1) as maxBalance</code>
            </li>
          </ul>
        </div>

        {fieldsErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              {fieldsErrors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
