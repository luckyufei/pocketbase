// T009: URL 字段选项组件
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { useState } from 'react'

export interface UrlField {
  name: string
  type: 'url'
  exceptDomains?: string[]
  onlyDomains?: string[]
  [key: string]: unknown
}

interface UrlFieldOptionsProps {
  field: UrlField
  onChange: (field: UrlField) => void
}

export function UrlFieldOptions({ field, onChange }: UrlFieldOptionsProps) {
  const [onlyInput, setOnlyInput] = useState('')
  const [exceptInput, setExceptInput] = useState('')

  const handleAddDomain = (type: 'onlyDomains' | 'exceptDomains', value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return

    const current = field[type] || []
    if (!current.includes(trimmed)) {
      onChange({ ...field, [type]: [...current, trimmed] })
    }

    if (type === 'onlyDomains') {
      setOnlyInput('')
    } else {
      setExceptInput('')
    }
  }

  const handleRemoveDomain = (type: 'onlyDomains' | 'exceptDomains', domain: string) => {
    const current = field[type] || []
    onChange({ ...field, [type]: current.filter((d) => d !== domain) })
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    type: 'onlyDomains' | 'exceptDomains',
    value: string
  ) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleAddDomain(type, value)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Only domains</Label>
        <p className="text-xs text-muted-foreground">
          Allow URLs ONLY from the listed domains. Leave empty for no restriction.
        </p>
        <div className="flex flex-wrap gap-1 mb-2">
          {(field.onlyDomains || []).map((domain) => (
            <Badge key={domain} variant="secondary" className="gap-1">
              {domain}
              <button
                type="button"
                onClick={() => handleRemoveDomain('onlyDomains', domain)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Input
          placeholder="e.g. example.com"
          value={onlyInput}
          onChange={(e) => setOnlyInput(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 'onlyDomains', onlyInput)}
          onBlur={() => handleAddDomain('onlyDomains', onlyInput)}
        />
      </div>

      <div className="space-y-2">
        <Label>Except domains</Label>
        <p className="text-xs text-muted-foreground">Block URLs from the listed domains.</p>
        <div className="flex flex-wrap gap-1 mb-2">
          {(field.exceptDomains || []).map((domain) => (
            <Badge key={domain} variant="secondary" className="gap-1">
              {domain}
              <button
                type="button"
                onClick={() => handleRemoveDomain('exceptDomains', domain)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Input
          placeholder="e.g. spam.com"
          value={exceptInput}
          onChange={(e) => setExceptInput(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 'exceptDomains', exceptInput)}
          onBlur={() => handleAddDomain('exceptDomains', exceptInput)}
        />
      </div>
    </div>
  )
}
