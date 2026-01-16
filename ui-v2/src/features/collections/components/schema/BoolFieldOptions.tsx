// T007: Bool 字段选项组件
// Bool 类型没有额外的选项配置

export interface BoolField {
  name: string
  type: 'bool'
  [key: string]: unknown
}

interface BoolFieldOptionsProps {
  field: BoolField
  onChange: (field: BoolField) => void
}

export function BoolFieldOptions({ field: _field, onChange: _onChange }: BoolFieldOptionsProps) {
  return (
    <div className="text-sm text-muted-foreground py-2">
      No additional options for boolean fields.
    </div>
  )
}
