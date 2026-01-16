/**
 * 集合查询标签页
 * 用于 View 类型集合的 SQL 查询编辑
 */
import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CodeEditor } from '@/components/CodeEditor'
import { extractColumnsFromQuery, sentenize } from '@/lib/utils'
import type { CollectionModel } from 'pocketbase'

interface CollectionQueryTabProps {
  collection: CollectionModel & { viewQuery?: string }
  onChange: (viewQuery: string) => void
  errors?: Record<string, unknown>
}

export function CollectionQueryTab({ collection, onChange, errors = {} }: CollectionQueryTabProps) {
  // 解析字段错误
  const fieldsErrors = useMemo(() => {
    const result: string[] = []
    const raw = errors?.fields as
      | Record<string, Record<string, { message: string }>>
      | { message?: string }
      | undefined

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
          Select 查询 <span className="text-destructive">*</span>
        </Label>

        <CodeEditor
          id="viewQuery"
          language="sql"
          placeholder="例如: SELECT id, name from posts"
          value={collection.viewQuery || ''}
          onChange={onChange}
          minHeight={150}
          className={fieldsErrors.length > 0 ? 'border-destructive' : ''}
        />

        <div className="text-sm text-muted-foreground space-y-1">
          <ul className="list-disc list-inside space-y-1">
            <li>
              不支持通配符列 (<code>*</code>)
            </li>
            <li>
              查询必须包含唯一的 <code>id</code> 列。
              <br />
              如果查询没有合适的列，可以使用 <code>(ROW_NUMBER() OVER()) as id</code>
            </li>
            <li>
              表达式必须使用有效格式的字段名作为别名，例如 <code>MAX(balance) as maxBalance</code>
            </li>
            <li>
              组合/多空格表达式必须用括号包裹，例如 <code>(MAX(balance) + 1) as maxBalance</code>
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
