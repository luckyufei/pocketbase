/**
 * SecretFieldOptions - Secret 字段类型选项组件
 * Phase 2.1: 实现 Secret 字段类型的 maxSize 选项
 */
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface SecretFieldOptionsProps {
  field: any
  onChange: (field: any) => void
}

export function SecretFieldOptions({ field, onChange }: SecretFieldOptionsProps) {
  const maxSize = field.maxSize || 4096
  
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="maxSize">Max size</Label>
        <Input
          id="maxSize"
          type="number"
          value={maxSize}
          onChange={(e) => onChange({ 
            ...field, 
            maxSize: parseInt(e.target.value) || 4096 
          })}
        />
        <p className="text-xs text-slate-500">Default to ~4KB</p>
      </div>
    </div>
  )
}
