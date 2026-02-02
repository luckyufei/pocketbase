/**
 * FilterSyntax 组件
 * 过滤语法文档
 */
import { FILTER_OPERATORS } from '@/lib/apiDocsUtils'
import { CodeBlock } from './CodeBlock'

interface FilterSyntaxProps {
  className?: string
}

export function FilterSyntax({ className }: FilterSyntaxProps) {
  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground mb-3">支持的过滤操作符和语法：</p>

      <div className="space-y-4">
        {/* 操作符表格 */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium w-24">操作符</th>
                <th className="text-left p-2 font-medium">说明</th>
                <th className="text-left p-2 font-medium w-40">示例</th>
              </tr>
            </thead>
            <tbody>
              {FILTER_OPERATORS.map((op) => (
                <tr key={op.operator} className="border-t">
                  <td className="p-2">
                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs">{op.operator}</code>
                  </td>
                  <td className="p-2 text-muted-foreground">{op.description}</td>
                  <td className="p-2">
                    <code className="text-xs">{op.example}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 示例 */}
        <div>
          <p className="text-sm font-medium mb-2">过滤示例：</p>
          <CodeBlock
            content={`// 简单过滤
?filter=(status='active')

// 多条件组合
?filter=(status='active' && created>'2024-01-01')

// 使用 OR
?filter=(status='active' || status='pending')

// 嵌套条件
?filter=((status='active' && priority>5) || featured=true)

// 关系字段过滤
?filter=(author.name~'John')

// 数组包含
?filter=(tags?~'important')`}
            language="text"
            showCopy={false}
          />
        </div>

        {/* 特殊值 */}
        <div>
          <p className="text-sm font-medium mb-2">特殊值：</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>
              <code className="text-xs">@now</code> - 当前时间
            </li>
            <li>
              <code className="text-xs">@request.auth.id</code> - 当前认证用户的 ID
            </li>
            <li>
              <code className="text-xs">@request.auth.collectionId</code> - 当前认证用户的集合 ID
            </li>
            <li>
              <code className="text-xs">@collection.collectionName.fieldName</code> -
              引用其他集合的字段
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
