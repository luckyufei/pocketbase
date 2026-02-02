/**
 * FieldsQueryParam 组件
 * 字段查询参数文档
 */
import { CodeBlock } from './CodeBlock'

interface FieldsQueryParamProps {
  className?: string
}

export function FieldsQueryParam({ className }: FieldsQueryParamProps) {
  return (
    <div className={className}>
      <h4 className="text-sm font-medium mb-2">fields 参数</h4>
      <p className="text-sm text-muted-foreground mb-3">
        使用 <code className="text-xs">fields</code> 参数可以指定返回的字段，减少响应数据量。
      </p>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium mb-1">选择特定字段：</p>
          <CodeBlock content={`?fields=id,title,created`} language="text" showCopy={false} />
        </div>

        <div>
          <p className="text-sm font-medium mb-1">排除特定字段：</p>
          <CodeBlock content={`?fields=*,-content,-metadata`} language="text" showCopy={false} />
        </div>

        <div>
          <p className="text-sm font-medium mb-1">选择展开关系的字段：</p>
          <CodeBlock
            content={`?expand=author&fields=id,title,expand.author.name`}
            language="text"
            showCopy={false}
          />
        </div>

        <div className="text-sm text-muted-foreground">
          <p>说明：</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>
              <code className="text-xs">*</code> 表示所有字段
            </li>
            <li>
              <code className="text-xs">-fieldName</code> 表示排除该字段
            </li>
            <li>
              <code className="text-xs">expand.relationField.subField</code>{' '}
              用于选择展开关系中的字段
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
