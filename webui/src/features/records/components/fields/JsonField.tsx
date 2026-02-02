/**
 * JsonField - JSON 字段组件
 * 用于编辑 json 类型的记录字段
 */
import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface JsonFieldProps {
  field: {
    name: string
    type: string
    required: boolean
    options?: Record<string, unknown>
  }
  value: unknown
  onChange: (value: unknown) => void
}

export function JsonField({ field, value, onChange }: JsonFieldProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      setText(JSON.stringify(value, null, 2))
      setError(null)
    } catch {
      setText(String(value))
    }
  }, [value])

  const handleChange = (newText: string) => {
    setText(newText)
    try {
      const parsed = JSON.parse(newText)
      setError(null)
      onChange(parsed)
    } catch (e) {
      setError('Invalid JSON')
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{field.name}</Label>
      <Textarea
        id={field.name}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        required={field.required}
        className={`min-h-[120px] font-mono text-sm ${error ? 'border-destructive' : ''}`}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
