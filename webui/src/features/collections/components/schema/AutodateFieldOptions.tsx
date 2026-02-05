// T017: Autodate 字段选项组件
// 注意：Autodate 字段的 onCreate/onUpdate 选项在字段行中显示（通过下拉选择器）
// 展开面板中只显示 Hidden 和 Presentable 选项，这里不需要额外内容

export interface AutodateField {
  name: string
  type: 'autodate'
  onCreate?: boolean
  onUpdate?: boolean
  [key: string]: unknown
}

interface AutodateFieldOptionsProps {
  field: AutodateField
  onChange: (field: AutodateField) => void
}

// Autodate 字段在展开面板中没有额外选项
// onCreate/onUpdate 选项通过字段行中的下拉选择器设置
export function AutodateFieldOptions({ field, onChange }: AutodateFieldOptionsProps) {
  // 返回 null，因为 autodate 特有的选项显示在字段行中
  return null
}
