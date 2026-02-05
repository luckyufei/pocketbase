// T007: Bool 字段选项组件
// Bool 类型没有额外的选项配置（与 UI 版本保持一致，不显示任何内容）

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
  // 与 UI 版本保持一致：Bool 字段展开面板中不显示额外选项文案
  return null
}
