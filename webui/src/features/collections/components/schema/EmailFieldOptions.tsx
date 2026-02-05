// T008: Email 字段选项组件
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Info, X } from 'lucide-react'
import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export interface EmailField {
  name: string
  type: 'email'
  exceptDomains?: string[]
  onlyDomains?: string[]
  [key: string]: unknown
}

interface EmailFieldOptionsProps {
  field: EmailField
  onChange: (field: EmailField) => void
}

export function EmailFieldOptions({ field, onChange }: EmailFieldOptionsProps) {
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

  const isOnlyDomainsDisabled = (field.exceptDomains?.length || 0) > 0
  const isExceptDomainsDisabled = (field.onlyDomains?.length || 0) > 0

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Except domains - 左侧 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label>Except domains</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>List of domains that are NOT allowed.<br/>This field is disabled if "Only domains" is set.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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
          disabled={isExceptDomainsDisabled}
          value={exceptInput}
          onChange={(e) => setExceptInput(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 'exceptDomains', exceptInput)}
          onBlur={() => handleAddDomain('exceptDomains', exceptInput)}
        />
        <p className="text-xs text-muted-foreground">Use comma as separator.</p>
      </div>

      {/* Only domains - 右侧 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label>Only domains</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>List of domains that are ONLY allowed.<br/>This field is disabled if "Except domains" is set.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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
          disabled={isOnlyDomainsDisabled}
          value={onlyInput}
          onChange={(e) => setOnlyInput(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 'onlyDomains', onlyInput)}
          onBlur={() => handleAddDomain('onlyDomains', onlyInput)}
        />
        <p className="text-xs text-muted-foreground">Use comma as separator.</p>
      </div>
    </div>
  )
}
